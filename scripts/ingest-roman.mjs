import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const readJson = async (file) => JSON.parse(await fs.readFile(path.join(root, file), 'utf8'))
const writeJson = async (file, value) => {
  await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true })
  await fs.writeFile(path.join(root, file), `${JSON.stringify(value, null, 2)}\n`)
}

const decodeXml = (value = '') =>
  value
    .replaceAll('<![CDATA[', '')
    .replaceAll(']]>', '')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))

const stripHtml = (value = '') =>
  decodeXml(value)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const tag = (item, name) => {
  const match = item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))
  return match ? decodeXml(match[1]).trim() : ''
}

function parseRss(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => {
    const item = match[1]
    const description = tag(item, 'description')
    const encoded = tag(item, 'content:encoded')
    return {
      title: stripHtml(tag(item, 'title')),
      url: stripHtml(tag(item, 'link')),
      publishedAt: tag(item, 'pubDate') ? new Date(tag(item, 'pubDate')).toISOString() : undefined,
      text: stripHtml(`${description} ${encoded}`),
    }
  })
}

const recognizers = [
  {
    milestone: 'hga_deploy',
    status: 'complete',
    matches: (text) =>
      /(high[- ]gain antenna.{0,160}(has |have )?(successfully )?deployed|antenna deployment.{0,160}(concluded|completed))/i.test(text),
    title: 'High-gain antenna deployed',
  },
  {
    milestone: 'aperture_cover_deploy',
    status: 'complete',
    matches: (text) =>
      /(deployable aperture cover.{0,180}(successfully completed|was successfully deployed|has successfully deployed|deployment.{0,50}completed)|aperture cover.{0,180}(successfully completed|deployment.{0,50}completed))/i.test(text),
    title: 'Deployable aperture cover deployed',
  },
  {
    milestone: 'coronagraph_power_on',
    status: 'complete',
    matches: (text) =>
      /(coronagraph instrument.{0,140}(has been successfully activated|has successfully powered on|has powered on|was successfully activated)|has successfully activated.{0,100}coronagraph instrument)/i.test(text),
    title: 'Coronagraph Instrument powered on',
  },
  {
    milestone: 'wfi_power_on',
    status: 'complete',
    matches: (text) =>
      /((wide field instrument|\bWFI\b).{0,140}(has been successfully activated|has successfully powered on|has powered on|was successfully activated)|has successfully activated.{0,100}(wide field instrument|\bWFI\b))/i.test(text),
    title: 'Wide Field Instrument powered on',
  },
  {
    milestone: 'mcc2',
    status: 'not_required',
    matches: (text) =>
      /(second|#2).{0,50}mid-course correction.{0,180}(not required|not needed|unnecessary)/i.test(text),
    title: 'Second mid-course correction not required',
  },
  {
    milestone: 'mcc2',
    status: 'complete',
    matches: (text) =>
      /(second|#2).{0,50}mid-course correction.{0,180}(was successfully completed|has been completed|completed successfully|burn.{0,40}(completed|concluded))/i.test(text),
    title: 'Second mid-course correction complete',
  },
  {
    milestone: 'l2',
    status: 'complete',
    matches: (text) =>
      /(orbit insertion.{0,120}(completed|successful)|entered.{0,80}(L2|second Lagrange point)|arrived at.{0,40}L2)/i.test(text),
    title: 'L2 orbit insertion complete',
  },
  {
    milestone: 'science',
    status: 'complete',
    matches: (text) =>
      /(first[- ]look (images|observations).{0,100}(have been |were )?released|first images.{0,100}(have been |were )released|science operations.{0,100}(have begun|began|have started|started|are underway))/i.test(text),
    title: 'First-look observations / science operations',
  },
]

function recognize(item) {
  const text = `${item.title} ${item.text}`
  return recognizers
    .filter((rule) => rule.matches(text))
    .map((rule) => ({
      id: `rss:${rule.milestone}:${item.url}`,
      milestone: rule.milestone,
      status: rule.status,
      publishedAt: item.publishedAt,
      title: rule.title,
      summary: item.title,
      source: item.url,
      sourceType: 'nasa-roman-rss',
    }))
}

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

const mission = await readJson('data/mission.json')
const milestones = await readJson('data/milestones.json')
let events = await readJson('data/events.json')
const sourceState = await readJson('data/source-state.json')

const response = await fetch(mission.blogFeed, {
  headers: { 'user-agent': 'roman-mission-monitor/0.1 (+https://github.com/rmlowe/roman-mission-monitor)' },
})
if (!response.ok) throw new Error(`Roman RSS fetch failed: ${response.status} ${response.statusText}`)

const items = parseRss(await response.text())
if (!items.length) throw new Error('Roman RSS feed contained no items')

// Re-run the current recognizers against items that are still present in the RSS
// feed. This lets us retract a machine-generated false positive after tightening a
// rule, without deleting older valid events merely because they have aged out of
// the feed window.
const currentFeedUrls = new Set(items.map((item) => item.url))
const recognizedEvents = items.flatMap(recognize)
const recognizedIds = new Set(recognizedEvents.map((event) => event.id))
const beforeReconcile = events.length
events = events.filter(
  (event) =>
    event.sourceType !== 'nasa-roman-rss' ||
    !currentFeedUrls.has(event.source) ||
    recognizedIds.has(event.id),
)
if (events.length !== beforeReconcile) {
  console.log(`Retracted ${beforeReconcile - events.length} invalid RSS-derived event(s)`)
}

const knownIds = new Set(events.map((event) => event.id))
for (const event of recognizedEvents) {
  if (!knownIds.has(event.id)) {
    events.push(event)
    knownIds.add(event.id)
    console.log(`Detected: ${event.title} (${event.source})`)
  }
}

sourceState.romanBlog.lastSeenItemUrl = items[0].url

const now = Date.now()
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
  (a, b) => new Date(b.publishedAt ?? b.occurredAt ?? 0) - new Date(a.publishedAt ?? a.occurredAt ?? 0),
)[0]

await writeJson('data/events.json', events)
await writeJson('data/source-state.json', sourceState)
await writeJson('src/generated/mission-status.json', {
  mission: {
    phase: 'Commissioning',
    latestHeadline: latest.title,
    latestSummary: latest.summary,
    latestSource: latest.source,
  },
  milestones: renderedMilestones,
})
