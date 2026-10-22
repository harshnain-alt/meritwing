/* Shared between the browser and /api/jobs/explain: what is sent to explain matches and what comes back. */

export type MatchInput = {
  /** The student's confirmed profile facts. */
  facts: { id: string; text: string }[];
  jobs: { id: string; title: string; company: string; description: string }[];
};

export type JobExplanation = {
  /** Each links a confirmed fact to the listing's own words. */
  fits: { reason: string; factId: string; factText: string; jobQuote: string }[];
  /** Requirements quoted from the listing that no confirmed fact supports. */
  gaps: string[];
  /** Suggestions the server dropped because they didn't quote the listing or cite a real fact. */
  removed: number;
  /** The board gave no description, so nothing could be compared. */
  noDescription: boolean;
};
