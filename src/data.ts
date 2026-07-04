export interface TrendingItem {
  id: string;
  title: string;
  type: "movie" | "tv";
  tmdbId: string;
  season?: number;
  episode?: number;
  description: string;
  backdrop: string;
  year: string;
}

export const TRENDING_ITEMS: TrendingItem[] = [
  {
    id: "1",
    title: "Inside Out 2",
    type: "movie",
    tmdbId: "1022789",
    description: "Teenager Riley's mind headquarters is undergoing a sudden demolition to make room for something entirely unexpected: new Emotions!",
    backdrop: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop",
    year: "2024",
  },
  {
    id: "2",
    title: "Deadpool & Wolverine",
    type: "movie",
    tmdbId: "533535",
    description: "A listless Wade Wilson toils in civilian life. But when his homeworld faces an existential threat, he must reluctantly suit-up again with an even more reluctant Wolverine.",
    backdrop: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=600&auto=format&fit=crop",
    year: "2024",
  },
  {
    id: "3",
    title: "Wednesday",
    type: "tv",
    tmdbId: "119051",
    season: 1,
    episode: 1,
    description: "Wednesday Addams, a sleuthing, supernaturally infused mystery solver, charts her years as a student at Nevermore Academy.",
    backdrop: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?q=80&w=600&auto=format&fit=crop",
    year: "S1 E1 - 2022",
  },
  {
    id: "4",
    title: "The Last of Us",
    type: "tv",
    tmdbId: "100088",
    season: 1,
    episode: 1,
    description: "Twenty years after modern civilization has been destroyed, Joel, a hardened survivor, is hired to smuggle Ellie, a 14-year-old girl, out of an oppressive quarantine zone.",
    backdrop: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?q=80&w=600&auto=format&fit=crop",
    year: "S1 E1 - 2023",
  },
  {
    id: "5",
    title: "Loki",
    type: "tv",
    tmdbId: "84958",
    season: 1,
    episode: 1,
    description: "The mercurial villain Loki resumes his role as the God of Mischief in a new series that takes place after the events of “Avengers: Endgame”.",
    backdrop: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=600&auto=format&fit=crop",
    year: "S1 E1 - 2021",
  }
];
