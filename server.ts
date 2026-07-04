import express, { json } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Readable } from "stream";
import { createServer as createViteServer } from "vite";
import { getTVSubtitleVTT } from "./src/utils/tvSubtitles.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;

export const OPENSUB_API_KEY = process.env.OPENSUB_API_KEY || "";
export const TMDB_API_KEY = process.env.TMDB_API_KEY || "";
export const TMDB_BEARER_TOKEN = process.env.TMDB_BEARER_TOKEN || "";

export const headers = {
  Authorization: `Bearer ${TMDB_BEARER_TOKEN}`,
  "Content-Type": "application/json;charset=utf-8",
};

app.use(cors());
app.use(json());

const PROVIDERS = [
  "https://vsembed.ru",
  "https://vsembed.su",
  "https://vidsrcme.ru",
];

export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
};

export const COMMON_LANGUAGES = Object.keys(LANGUAGE_NAMES);

// Simple in-memory cache to avoid scraping same query repeatedly (15 minutes)
const cache = new Map<string, any>();

async function scrapeProvider(domain: string, targetUrl: string) {
  console.log(`\n[${domain}] Starting scrape for URL: ${targetUrl}`);
  try {
    // 1. Fetch the embed page
    const embedRes = await fetch(targetUrl, { redirect: "follow" });
    if (!embedRes.ok) throw new Error(`Embed fetch failed: ${embedRes.status}`);
    const embedHtml = await embedRes.text();

    // 2. Extract rcp URL from iframe
    const rcpMatch = embedHtml.match(/src="\/\/(cloudorchestranova\.com\/rcp\/[^"]+)"/);
    if (!rcpMatch) throw new Error("RCP iframe not found in embed page");
    const rcpUrl = `https://${rcpMatch[1]}`;

    // 3. Fetch the RCP page
    const rcpRes = await fetch(rcpUrl, {
      headers: { Referer: targetUrl },
      redirect: "follow",
    });
    if (!rcpRes.ok) throw new Error(`RCP fetch failed: ${rcpRes.status}`);
    const rcpHtml = await rcpRes.text();

    // 4. Extract prorcp URL
    const prorcpMatch = rcpHtml.match(/src:\s*'(\/prorcp\/[^']+)'/);
    if (!prorcpMatch) throw new Error("ProRCP URL not found in RCP page");
    const prorcpUrl = `https://cloudorchestranova.com${prorcpMatch[1]}`;

    // 5. Fetch the ProRCP page
    const prorcpRes = await fetch(prorcpUrl, {
      headers: { Referer: rcpUrl },
      redirect: "follow",
    });
    if (!prorcpRes.ok) throw new Error(`ProRCP fetch failed: ${prorcpRes.status}`);
    const prorcpHtml = await prorcpRes.text();

    // 6. Extract master_urls and token generation host
    let masterUrls = "";
    const masterUrlsMatch = prorcpHtml.match(/var\s+master_urls\s*=\s*['"]([^'"]+)['"]/i);
    const fileMatch = prorcpHtml.match(/file:\s*['"](.*?)['"]/i);

    if (masterUrlsMatch) {
      masterUrls = masterUrlsMatch[1];
    } else if (fileMatch) {
      masterUrls = fileMatch[1];
    } else {
      const fallbackMatch = prorcpHtml.match(/(https:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
      if (fallbackMatch) {
        masterUrls = fallbackMatch[1];
      } else {
        throw new Error("No stream URL found in ProRCP source");
      }
    }

    let hlsUrl = masterUrls.split(" or ")[0];

    // 7. Get token if needed
    if (hlsUrl.includes("__TOKEN__")) {
      const m3u8UrlObj = new URL(hlsUrl);
      const tokenHost = m3u8UrlObj.host;
      try {
        const tokenRes = await fetch(`https://${tokenHost}/generate.php`, {
          headers: { Referer: prorcpUrl },
        });
        if (tokenRes.ok) {
          const token = await tokenRes.text();
          hlsUrl = hlsUrl.replace(/__TOKEN__/g, token.trim());
        }
      } catch (e) {
        console.warn(`[${domain}] Failed to generate token:`, e);
      }
    }

    // Proxy the hlsUrl to avoid IP lock issues on the client
    const proxiedHlsUrl = `/proxy/m3u8?url=${encodeURIComponent(hlsUrl)}`;

    // 8. Extract subtitles
    const subtitles: string[] = [];
    const subsMatch = prorcpHtml.match(/var\s+default_subtitles\s*=\s*['"]([^'"]+)['"]/i);
    if (subsMatch && subsMatch[1] && subsMatch[1] !== "[]") {
      const subsArray = subsMatch[1].split(",");
      for (const sub of subsArray) {
        const parts = sub.split("]");
        if (parts.length === 2) {
          subtitles.push(parts[1]);
        } else {
          subtitles.push(sub);
        }
      }
    }

    return { hls_url: proxiedHlsUrl, subtitles, error: null };
  } catch (error: any) {
    console.error(`[${domain}] Error: ${error.message}`);
    return { hls_url: null, subtitles: [], error: error.message };
  }
}

// Extract endpoint for m3u8 scraper
app.get("/extract", async (req, res) => {
  const type = (req.query.type as string) || "movie";
  const tmdb_id = req.query.tmdb_id as string;
  const season = req.query.season ? parseInt(req.query.season as string) : undefined;
  const episode = req.query.episode ? parseInt(req.query.episode as string) : undefined;

  if (!tmdb_id) {
    return res.status(400).json({
      success: false,
      error: "tmdb_id query param is required",
      results: {},
    });
  }

  if (type === "tv" && (season == null || episode == null)) {
    return res.status(400).json({
      success: false,
      error: "season and episode query params are required for TV shows",
      results: {},
    });
  }

  const cacheKey = JSON.stringify(req.query);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 1000 * 60 * 15) {
    console.log("Serving from cache");
    return res.json(cached.response);
  }

  const urls = PROVIDERS.reduce((acc: Record<string, string>, domain) => {
    acc[domain] =
      type === "tv"
        ? `${domain}/embed/tv?tmdb=${tmdb_id}&season=${season}&episode=${episode}`
        : `${domain}/embed/movie/${tmdb_id}`;
    return acc;
  }, {});

  try {
    const resultsArr = await Promise.all(
      Object.entries(urls).map(async ([domain, url]) => {
        try {
          const result = await scrapeProvider(domain, url);
          return [domain, result];
        } catch (err: any) {
          console.error(`[${domain}] Final error: ${err.message}`);
          return [
            domain,
            { hls_url: null, subtitles: [], error: err.message },
          ];
        }
      })
    );

    const results = Object.fromEntries(resultsArr);
    const success = Object.values(results).some((r: any) => r.hls_url);

    const response = { success, results };

    cache.set(cacheKey, {
      timestamp: Date.now(),
      response,
    });

    res.json(response);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Unexpected server error",
      results: {},
    });
  }
});

async function getIMDbIdFromTMDB(tmdb_id: string, type = "movie") {
  const url = `https://api.themoviedb.org/3/${type}/${tmdb_id}/external_ids?api_key=${TMDB_API_KEY}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error("Failed to fetch IMDb ID from TMDB");
  const data: any = await response.json();
  return data.imdb_id || null;
}

async function searchSubtitles(imdb_id: string) {
  const res = await fetch(
    `https://api.opensubtitles.com/api/v1/subtitles?imdb_id=${imdb_id}&per_page=100&page=1`,
    {
      headers: {
        "Api-Key": OPENSUB_API_KEY,
        "User-Agent": "Cinemi v1.0.0",
      },
    }
  );

  if (!res.ok) {
    console.error("[OpenSubtitles] Request failed");
    return [];
  }

  const data: any = await res.json();
  if (!data.data || data.data.length === 0) {
    return [];
  }

  return (data.data || [])
    .filter(
      (item: any) =>
        item.attributes?.files?.[0]?.file_id &&
        COMMON_LANGUAGES.includes(item.attributes.language)
    )
    .map((item: any) => {
      const file = item.attributes.files[0];
      const lang = item.attributes.language;
      return {
        language: lang,
        language_name: LANGUAGE_NAMES[lang] || lang,
        file_id: file.file_id,
        download_count: item.attributes.download_count || 0,
      };
    })
    .sort((a: any, b: any) => b.download_count - a.download_count)
    .slice(0, 2);
}

async function getSubtitleDownloadUrl(file_id: string) {
  const res = await fetch("https://api.opensubtitles.com/api/v1/download", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": OPENSUB_API_KEY,
      "User-Agent": "Cinemi v1.0.0",
    },
    body: JSON.stringify({ file_id }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[OpenSubtitles] Failed to get download link:", text);
    throw new Error("Subtitle download URL fetch failed");
  }

  const data: any = await res.json();
  return data.link;
}

app.get("/movie-subtitles", async (req, res) => {
  const tmdb_id = req.query.tmdb_id as string;
  const type = (req.query.type as string) || "movie";

  if (!tmdb_id) {
    return res
      .status(400)
      .json({ success: false, error: "tmdb_id is required" });
  }

  try {
    const imdb_id = await getIMDbIdFromTMDB(tmdb_id, type);
    if (!imdb_id) {
      return res
        .status(404)
        .json({ success: false, error: "IMDb ID not found" });
    }

    const baseList = await searchSubtitles(imdb_id);

    const subtitles = await Promise.all(
      baseList.map(async (sub: any) => {
        if (sub.url) return sub;
        try {
          const url = await getSubtitleDownloadUrl(sub.file_id);
          return {
            language: sub.language,
            language_name: sub.language_name,
            url,
          };
        } catch {
          return null;
        }
      })
    );

    res.json({
      success: true,
      subtitles: subtitles.filter(Boolean),
      meta: {
        tmdb_id,
        imdb_id,
        type,
      },
    });
  } catch (err: any) {
    console.error("[/subtitles] Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/tv-subtitles", async (req, res) => {
  const title = req.query.title as string;
  const season = parseInt(req.query.season as string);
  const episode = parseInt(req.query.episode as string);
  const type = req.query.type as string;

  try {
    if (type === "tv") {
      const vtt = await getTVSubtitleVTT(title, season, episode);
      if (!vtt) return res.status(404).send("No subtitle found");
      return res.set("Content-Type", "text/vtt").send(vtt);
    }

    res.status(400).send("Invalid type provided");
  } catch (err: any) {
    console.error("❌ Subtitle API Error:", err.message);
    res.status(500).send("Internal server error");
  }
});

app.get("/subtitle-proxy", async (req, res) => {
  const fileUrl = req.query.url as string;
  if (!fileUrl) return res.status(400).send("Missing subtitle URL");

  try {
    const subtitleRes = await fetch(fileUrl);
    const srt = await subtitleRes.text();

    const vtt =
      "WEBVTT\n\n" +
      srt
        .replace(/\r+/g, "")
        .replace(/^\s+|\s+$/g, "")
        .split("\n")
        .map((line) =>
          line.replace(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/g, "$1:$2:$3.$4")
        )
        .join("\n");

    res.setHeader("Content-Type", "text/vtt");
    res.send(vtt);
  } catch (err: any) {
    console.error("Subtitle Proxy Error:", err.message);
    res.status(500).send("Failed to convert subtitle");
  }
});

app.get("/proxy/m3u8", async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) return res.status(400).send("Missing url");

  try {
    const fetchRes = await fetch(targetUrl, {
      headers: {
        "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
        "Referer": "https://cloudorchestranova.com/",
      },
    });

    if (!fetchRes.ok) {
      return res.status(fetchRes.status).send("Failed to fetch m3u8");
    }

    let m3u8Content = await fetchRes.text();

    const targetUrlObj = new URL(targetUrl);
    const hostUrl = `${targetUrlObj.protocol}//${targetUrlObj.host}`;
    const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);

    const rewritten = m3u8Content
      .split("\n")
      .map((line) => {
        const tline = line.trim();
        if (!tline || tline.startsWith("#")) return line;

        let fullUrl = tline;
        if (tline.startsWith("http")) {
          fullUrl = tline;
        } else if (tline.startsWith("/")) {
          fullUrl = hostUrl + tline;
        } else {
          fullUrl = baseUrl + tline;
        }

        // Check if the URL is another m3u8 or a ts chunk
        if (fullUrl.includes(".m3u8")) {
          return `/proxy/m3u8?url=${encodeURIComponent(fullUrl)}`;
        } else {
          return `/proxy/ts?url=${encodeURIComponent(fullUrl)}`;
        }
      })
      .join("\n");

    res.set("Content-Type", "application/vnd.apple.mpegurl");
    res.send(rewritten);
  } catch (err: any) {
    res.status(500).send("Proxy error: " + err.message);
  }
});

app.get("/proxy/ts", async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) return res.status(400).send("Missing url");

  try {
    const fetchRes = await fetch(targetUrl, {
      headers: {
        "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
        "Referer": "https://cloudorchestranova.com/",
      },
    });

    if (!fetchRes.ok) {
      return res.status(fetchRes.status).send("Failed to fetch ts");
    }

    // Always force MPEG-TS video content type to avoid MIME-type decode issues in browsers
    res.set("Content-Type", "video/mp2t");
    res.set("Access-Control-Allow-Origin", "*");

    // stream the response
    if (fetchRes.body) {
      // @ts-ignore
      Readable.fromWeb(fetchRes.body).pipe(res);
    } else {
      res.send(Buffer.from(await fetchRes.arrayBuffer()));
    }
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).send("Proxy error: " + err.message);
    }
  }
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
