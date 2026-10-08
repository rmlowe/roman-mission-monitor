import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { recordSuccessfulCheck } from './collection-health.mjs'
import path from 'node:path'
import { parseCommissioningPage } from './parse-commissioning.mjs'
import { buildMissionStatus } from './build-mission-status.mjs'
import { recognize, discardLegacyScienceEvents } from './recognize-events.mjs'

const root = process.cwd()
const readJson = async (file) => JSON.parse(await fs.readFile(path.join(root, file), 'utf8'))
const readJsonIfPresent = async (file) => {
  try {
    return await readJson(file)
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined
    throw error
  }
}
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
      summary: stripHtml(description),
      text: stripHtml(`${description} ${encoded}`),
    }
  })
}

const mission = await readJson('data/mission.json')
const milestones = await readJson('data/milestones.json')
// Old science recognitions conflated image release with science operations.
// Retract even aged-out RSS events; current feed evidence is recognized again below.
let events = discardLegacyScienceEvents(await readJson('data/events.json'))
const sourceState = await readJson('data/source-state.json')

const requestHeaders = {
  'user-agent': 'roman-mission-monitor/0.1 (+https://github.com/rmlowe/roman-mission-monitor)',
}
const [blogResponse, commissioningResponse] = await Promise.all([
  fetch(mission.blogFeed, { headers: requestHeaders }),
  fetch(mission.commissioningPage, { headers: requestHeaders }),
])

if (!blogResponse.ok) throw new Error(`Roman RSS fetch failed: ${blogResponse.status} ${blogResponse.statusText}`)
if (!commissioningResponse.ok) {
  throw new Error(
    `Roman commissioning fetch failed: ${commissioningResponse.status} ${commissioningResponse.statusText}`,
  )
}

const items = parseRss(await blogResponse.text())
if (!items.length) throw new Error('Roman RSS feed contained no items')

const commissioningSnapshot = parseCommissioningPage(await commissioningResponse.text(), {
  url: mission.commissioningPage,
})
const previousCommissioningSnapshot = await readJsonIfPresent('data/observations/commissioning.json')
if (previousCommissioningSnapshot?.source?.contentHash !== commissioningSnapshot.source.contentHash) {
  await writeJson('data/observations/commissioning.json', commissioningSnapshot)
  console.log(`Commissioning page semantic content changed: ${commissioningSnapshot.source.contentHash}`)
}
sourceState.romanCommissioning = {
  contentHash: commissioningSnapshot.source.contentHash,
  ...(commissioningSnapshot.source.pageLastUpdated
    ? { pageLastUpdated: commissioningSnapshot.source.pageLastUpdated }
    : {}),
}

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

await writeJson('data/events.json', events)
await writeJson('data/source-state.json', sourceState)
await writeJson('src/generated/mission-status.json', buildMissionStatus({ milestones, events, items }))

// Written only after both sources have fetched and parsed successfully.
const checkedAt = new Date().toISOString()
const previousHealth = await readJsonIfPresent('data/collection-health.json')
const health = recordSuccessfulCheck(previousHealth, {
  romanBlog: { url: mission.blogFeed, contentHash: createHash('sha256').update(JSON.stringify([...items].sort((a, b) => a.url.localeCompare(b.url)))).digest('hex') },
  romanCommissioning: { url: mission.commissioningPage, contentHash: commissioningSnapshot.source.contentHash },
}, checkedAt)
await writeJson('data/collection-health.json', health)
