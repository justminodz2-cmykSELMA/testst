import { useState } from "react";
import { 
  Play, 
  Tv, 
  Film, 
  Search, 
  Sparkles, 
  Copy, 
  Check, 
  AlertCircle, 
  Radio, 
  Info,
  ChevronRight,
  Loader2
} from "lucide-react";
import { VideoPlayer } from "./components/VideoPlayer";
import { TRENDING_ITEMS, TrendingItem } from "./data";

export default function App() {
  const [activeTab, setActiveTab] = useState<"movie" | "tv">("movie");
  const [tmdbId, setTmdbId] = useState("");
  const [season, setSeason] = useState("1");
  const [episode, setEpisode] = useState("1");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractionResult, setExtractionResult] = useState<any>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [activeMediaTitle, setActiveMediaTitle] = useState<string>("");

  // Handle playing trending item
  const handlePlayTrending = (item: TrendingItem) => {
    setActiveTab(item.type);
    setTmdbId(item.tmdbId);
    if (item.type === "tv") {
      setSeason(String(item.season || 1));
      setEpisode(String(item.episode || 1));
    }
    setActiveMediaTitle(item.title);
    triggerExtraction(item.type, item.tmdbId, item.season, item.episode, item.title);
  };

  const handleCustomExtract = () => {
    if (!tmdbId) {
      setError("Please enter a valid TMDB ID");
      return;
    }
    const label = activeTab === "movie" ? `Movie (TMDB: ${tmdbId})` : `TV Show (TMDB: ${tmdbId}) S${season}E${episode}`;
    setActiveMediaTitle(label);
    triggerExtraction(
      activeTab, 
      tmdbId, 
      activeTab === "tv" ? parseInt(season) : undefined, 
      activeTab === "tv" ? parseInt(episode) : undefined,
      label
    );
  };

  const triggerExtraction = async (
    type: "movie" | "tv", 
    id: string, 
    s?: number, 
    e?: number,
    titleLabel?: string
  ) => {
    setLoading(true);
    setError(null);
    setExtractionResult(null);
    setSelectedProvider("");

    try {
      let queryUrl = `/extract?type=${type}&tmdb_id=${id}`;
      if (type === "tv") {
        queryUrl += `&season=${s || 1}&episode=${e || 1}`;
      }

      const res = await fetch(queryUrl);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to extract streams. Please try another TMDB ID or provider.");
      }

      setExtractionResult(data);
      
      // Auto-select first successful provider HLS URL
      const successfulProvider = Object.entries(data.results).find(([_, result]: any) => result.hls_url);
      if (successfulProvider) {
        setSelectedProvider(successfulProvider[0]);
      } else {
        throw new Error("No active stream found from any scraper source.");
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during extraction");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = (urlStr: string, key: string) => {
    navigator.clipboard.writeText(urlStr).then(() => {
      setCopiedText(key);
      setTimeout(() => setCopiedText(null), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans antialiased selection:bg-rose-600 selection:text-white">
      
      {/* Cinematic Navigation Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-gradient-to-tr from-rose-600 to-amber-500 text-white shadow-lg">
              <Film className="w-6 h-6 animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-none tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                CinemaStream
              </span>
              <span className="text-[10px] text-rose-500 font-medium tracking-widest uppercase mt-0.5">
                Direct HLS Scraper
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-mono text-zinc-400">High-Performance Proxy System Enabled</span>
          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left column - Scrape Inputs / Quick selects (5 cols) */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Main Scraper Card */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col gap-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-600/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex flex-col gap-1">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                <Search className="w-5 h-5 text-rose-500" />
                Find Media Stream
              </h2>
              <p className="text-xs text-zinc-400">Enter a TMDB ID to scrape direct high-performance HLS (.m3u8) links.</p>
            </div>

            {/* Movie/TV tabs switcher */}
            <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
              <button
                onClick={() => setActiveTab("movie")}
                className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                  activeTab === "movie" 
                    ? "bg-rose-600 text-white shadow-md font-semibold" 
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Film className="w-4 h-4" />
                Movie
              </button>
              <button
                onClick={() => setActiveTab("tv")}
                className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                  activeTab === "tv" 
                    ? "bg-rose-600 text-white shadow-md font-semibold" 
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Tv className="w-4 h-4" />
                TV Show
              </button>
            </div>

            {/* Input Controls */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-300">TMDB ID</label>
                <input
                  type="text"
                  placeholder="e.g. 1022789 (Inside Out 2)"
                  value={tmdbId}
                  onChange={(e) => setTmdbId(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                />
              </div>

              {activeTab === "tv" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-zinc-300">Season</label>
                    <input
                      type="number"
                      min="1"
                      value={season}
                      onChange={(e) => setSeason(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rose-500 transition-colors"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-zinc-300">Episode</label>
                    <input
                      type="number"
                      min="1"
                      value={episode}
                      onChange={(e) => setEpisode(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rose-500 transition-colors"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleCustomExtract}
              disabled={loading || !tmdbId}
              className="bg-gradient-to-r from-rose-600 to-rose-700 text-white font-bold py-3.5 rounded-xl text-sm hover:from-rose-500 hover:to-rose-600 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all duration-150 shadow-lg shadow-rose-950/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Extracting Clean Stream...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Extract & Play Stream
                </>
              )}
            </button>
          </div>

          {/* Quick Play Examples Box */}
          <div className="bg-zinc-900/50 border border-zinc-850 rounded-2xl p-6 flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <Sparkles className="text-amber-500 w-4.5 h-4.5" />
              Quick Play Testing Examples
            </h3>
            
            <div className="flex flex-col gap-3">
              {TRENDING_ITEMS.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => !loading && handlePlayTrending(item)}
                  className="group bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-800 p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <img 
                      src={item.backdrop} 
                      alt={item.title} 
                      className="w-16 aspect-video object-cover rounded-lg border border-zinc-800"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-white group-hover:text-rose-400 transition-colors">
                        {item.title}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-medium">
                        {item.type === "movie" ? "Movie" : "TV Show"} • {item.year}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-rose-500 group-hover:translate-x-0.5 transition-all" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right column - Video Player Stage & Proxy Output info (7 cols) */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Main Cinematic Video Player Area */}
          <div className="flex flex-col gap-3">
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">Cinematic Player Stage</h2>
            {selectedProvider && extractionResult?.results?.[selectedProvider]?.hls_url ? (
              <VideoPlayer 
                url={extractionResult.results[selectedProvider].hls_url}
                title={activeMediaTitle}
              />
            ) : (
              <div className="aspect-video bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col items-center justify-center p-8 text-center gap-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(225,29,72,0.05),transparent)] pointer-events-none" />
                <div className="w-16 h-16 rounded-full bg-zinc-950 flex items-center justify-center border border-zinc-800 text-zinc-600">
                  <Play className="w-6 h-6 fill-current" />
                </div>
                <div className="max-w-xs">
                  <p className="text-sm text-zinc-300 font-medium">Player Awaiting Stream Selection</p>
                  <p className="text-xs text-zinc-500 mt-1">Select a trending testing item on the left or enter a custom TMDB ID to launch the built-in HTML5 proxy player.</p>
                </div>
              </div>
            )}
          </div>

          {/* Loader Overlay for main column */}
          {loading && (
            <div className="bg-zinc-900/40 backdrop-blur-xs p-8 border border-zinc-850 rounded-2xl flex flex-col items-center justify-center gap-3 py-16">
              <Loader2 className="w-10 h-10 text-rose-500 animate-spin" />
              <p className="text-xs text-zinc-400 font-mono text-center">Bypassing AdBlockers, anti-devtool checks & generating fresh JWT Tokens...</p>
            </div>
          )}

          {/* Error Message banner */}
          {error && (
            <div className="bg-rose-950/20 border border-rose-900/60 p-4 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <h4 className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Extraction Failed</h4>
                <p className="text-xs text-rose-200/80 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* Extraction Output & Multi-source Selector Card */}
          {extractionResult && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-6 shadow-xl">
              
              {/* Provider Selection Tabs */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
                    Select Stream Scraper Source
                  </h3>
                  <span className="text-[10px] text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-850 font-mono">
                    Proxy Cache Active
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(extractionResult.results).map(([domain, data]: [string, any]) => {
                    const isSuccess = !!data.hls_url;
                    const isActive = selectedProvider === domain;
                    const cleanName = domain.replace("https://", "");

                    return (
                      <button
                        key={domain}
                        onClick={() => isSuccess && setSelectedProvider(domain)}
                        disabled={!isSuccess}
                        className={`p-3.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                          isActive 
                            ? "bg-rose-600/10 border-rose-500 text-white ring-1 ring-rose-500" 
                            : isSuccess 
                              ? "bg-zinc-950/60 hover:bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700" 
                              : "bg-zinc-950/20 border-zinc-900 text-zinc-600 cursor-not-allowed opacity-50"
                        }`}
                      >
                        <span className="text-xs font-bold tracking-tight">{cleanName}</span>
                        <span className={`text-[9px] font-semibold uppercase tracking-widest ${isSuccess ? "text-emerald-500" : "text-rose-500"}`}>
                          {isSuccess ? "ONLINE" : "OFFLINE"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Direct URLs details & Copy buttons */}
              {selectedProvider && extractionResult.results[selectedProvider]?.hls_url && (
                <div className="flex flex-col gap-4">
                  <div className="border-t border-zinc-800/80 my-1" />
                  
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-zinc-400">Proxied HLS Stream M3U8 Link</span>
                      <span className="text-[10px] text-rose-400 font-medium">Bypasses Client IP Lock & Blocks Ads</span>
                    </div>
                    <div className="flex bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden p-1.5 items-center justify-between gap-3">
                      <span className="text-xs font-mono text-zinc-300 truncate pl-2 flex-1">
                        {extractionResult.results[selectedProvider].hls_url}
                      </span>
                      <button
                        onClick={() => handleCopyUrl(extractionResult.results[selectedProvider].hls_url, "proxied")}
                        className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 p-2 rounded-lg text-zinc-300 hover:text-white active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                        title="Copy to Clipboard"
                      >
                        {copiedText === "proxied" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* VLC Player Guide */}
                  <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 flex gap-3">
                    <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-1">
                      <h4 className="text-xs font-semibold text-white">How to watch in VLC Player / Desktop Players:</h4>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Copy the **Proxied HLS Stream M3U8 Link** above, open your **VLC Player**, go to **Media** &gt; **Open Network Stream** (or Ctrl+N), paste the URL and play! 
                        The proxies fully convert TS formats into raw bytes, making them stream beautifully on any media player offline or online.
                      </p>
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}

        </section>

      </main>

      {/* Decorative Cinematic Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 mt-12 py-6 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-zinc-500 text-xs">
          <span>&copy; {new Date().getFullYear()} CinemaStream direct proxy service.</span>
          <div className="flex gap-4">
            <span className="hover:text-zinc-300 transition-colors">Anti-CORS Bypass Layer</span>
            <span>•</span>
            <span className="hover:text-zinc-300 transition-colors">VLC Universal Support</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
