// lastContentChangeAt is an observed change, never an inferred publication time.
export function recordSuccessfulCheck(previous, sources, checkedAt) {
  if (!Number.isFinite(Date.parse(checkedAt))) throw new Error('Invalid check time')
  return {
    schemaVersion: 1,
    lastSuccessfulCheckAt: checkedAt,
    staleAfterHours: 3,
    sources: Object.fromEntries(Object.entries(sources).map(([id, source]) => {
      const old = previous?.sources?.[id]
      return [id, {
        ...source,
        lastSuccessfulCheckAt: checkedAt,
        firstObservedAt: old?.firstObservedAt ?? checkedAt,
        lastContentChangeAt: old?.contentHash === source.contentHash
          ? old.lastContentChangeAt : old ? checkedAt : null,
      }]
    })),
  }
}
