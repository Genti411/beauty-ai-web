import { ingest } from '../lib/catalog/ingest';
import { SampleFeedSource } from '../lib/catalog/sample-feed';

ingest(new SampleFeedSource())
  .then((n) => {
    console.log(`Ingested ${n} products.`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
