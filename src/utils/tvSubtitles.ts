// Simple utility to mock TV subtitle fetching.
// In a real implementation, you would fetch subtitles for TV shows based on title/season/episode.
export async function getTVSubtitleVTT(title: string, season: number, episode: number) {
  return "WEBVTT\n\n1\n00:00:01.000 --> 00:00:05.000\nSubtitles for TV show not fully implemented.";
}
