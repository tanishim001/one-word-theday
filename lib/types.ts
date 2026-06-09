export type Answer = "known" | "unknown";

export type SeedWord = {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  example: string;
  publishDate: string;
  knownVotes: number;
  unknownVotes: number;
  sortOrder: number;
};

export type WordWithVotes = SeedWord & {
  totalVotes: number;
  knownPercent: number;
  unknownPercent: number;
  clientAnswer: Answer | null;
};

export type WordsResponse = {
  todayWordId: string;
  words: WordWithVotes[];
};
