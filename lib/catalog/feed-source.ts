import type { NormalizedProduct } from './types';

// A swappable catalog source. SampleFeedSource now; a real affiliate-feed
// adapter implements the same interface later.
export interface FeedSource {
  readonly source: string;
  fetchProducts(): Promise<NormalizedProduct[]>;
}
