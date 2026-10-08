import test from 'node:test'
import assert from 'node:assert/strict'
import { recordSuccessfulCheck } from '../scripts/collection-health.mjs'

test('unchanged successful checks advance freshness without inventing a content change', () => {
  const sources = { blog: { url: 'https://example.test/feed', contentHash: 'a' } }
  const first = recordSuccessfulCheck(undefined, sources, '2026-10-08T10:00:00Z')
  const next = recordSuccessfulCheck(first, sources, '2026-10-08T11:00:00Z')
  assert.equal(next.lastSuccessfulCheckAt, '2026-10-08T11:00:00Z')
  assert.equal(next.sources.blog.firstObservedAt, first.sources.blog.firstObservedAt)
  assert.equal(next.sources.blog.lastContentChangeAt, null)
  const changed = recordSuccessfulCheck(next, { blog: { ...sources.blog, contentHash: 'b' } }, '2026-10-08T12:00:00Z')
  assert.equal(changed.sources.blog.lastContentChangeAt, '2026-10-08T12:00:00Z')
  assert.equal(recordSuccessfulCheck(changed, { blog: { ...sources.blog, contentHash: 'b' } }, '2026-10-08T13:00:00Z').sources.blog.lastContentChangeAt, changed.sources.blog.lastContentChangeAt)
})
