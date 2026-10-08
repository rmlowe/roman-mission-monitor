# Roman Mission Monitor

Following NASA's Nancy Grace Roman Space Telescope from launch to science.

## Accuracy and collection health

Milestone completion requires evidence. The September 2026 ground-station,
fine-guidance and Coronagraph observations are manually verified NASA-report
events; day-level occurrence dates are kept separate from publication timestamps.
They do not complete overall optical alignment or the first science-image release.
The phase changes to Science operations only with a confirmed science event.

`data/collection-health.json` records the last successful end-to-end source check
and per-source content hashes. Unchanged fetches advance check time, not content
change time. The initial observation has no known content-change time. Failed
fetches/parses fail the workflow and leave the deployed snapshot intact; the page
marks that snapshot stale after three hours, including while the page stays open.
This is freshness of the last published successful check, not a live failure feed.

The hourly pipeline runs regression tests, ingests both NASA sources, and builds
before committing and deploying. Freshness updates intentionally cause an hourly
data commit/deployment even when NASA publishes no news. Tests/build failures
prevent committing the newly generated data. Deployment failures remain visible
in GitHub Actions and leave the previous site's timestamp to age.

Run `npm test` and `npm run build` locally. `node scripts/ingest-roman.mjs` performs
live reads and regenerates tracked data. MCP hosting is outside this change.
