function eventsFor(events, milestone) {
  return events.filter((event) => event.milestone === milestone)
}

function latestStateEvent(events, milestone) {
  return eventsFor(events, milestone).sort(
    (a, b) => new Date(b.publishedAt ?? b.occurredAt ?? 0) - new Date(a.publishedAt ?? a.occurredAt ?? 0),
  )[0]
}

function latestActualEvent(events, milestone) {
  return eventsFor(events, milestone)
    .filter((event) => event.occurredAt)
    .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))[0]
}

// News and recognised milestones are separate streams: an article need not
// confirm a timeline milestone to be the latest official update.
export function buildMissionStatus({ milestones, events, items, now = Date.now() }) {
  const renderedMilestones = milestones.map((milestone) => {
    const stateEvent = latestStateEvent(events, milestone.id)
    const actualEvent = latestActualEvent(events, milestone.id)
    let status = stateEvent?.status ?? milestone.defaultStatus
    if (!stateEvent && milestone.staleAfter && now > new Date(milestone.staleAfter).getTime()) {
      status = 'awaiting_confirmation'
    }
    return {
      id: milestone.id,
      title: milestone.title,
      timing: milestone.timing,
      actualAt: actualEvent?.occurredAt ?? milestone.actualAt,
      status,
      description: milestone.description,
      source: stateEvent?.source ?? milestone.source,
      ...(milestone.staleAfter ? { staleAfter: milestone.staleAfter } : {}),
    }
  })

  const latest = [...events].sort(
    (a, b) => new Date(b.publishedAt ?? b.occurredAt ?? 0) - new Date(a.publishedAt ?? a.occurredAt ?? 0) || Date.parse(b.occurredAt ?? b.occurredOn ?? b.publishedAt) - Date.parse(a.occurredAt ?? a.occurredOn ?? a.publishedAt) || b.id.localeCompare(a.id),
  )[0]

  const latestArticle = [...items].sort(
    (a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0),
  )[0]
  return {
    mission: {
      phase: latestStateEvent(events, 'science')?.status === 'complete'
        ? 'Science operations' : 'Commissioning',
      latestHeadline: latest.title,
      latestSummary: latest.summary,
      latestSource: latest.source,
      latestPublishedAt: latest.publishedAt,
      latestArticle: {
        title: latestArticle.title,
        summary: (latestArticle.summary || latestArticle.title).replace(/\s*The post [\s\S]* appeared first on [\s\S]*$/i, '').trim(),
        source: latestArticle.url,
        publishedAt: latestArticle.publishedAt,
      },
    },
    milestones: renderedMilestones,
  }
}
