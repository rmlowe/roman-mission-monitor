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
    matches: (text) => /high[- ]gain antenna/i.test(text) && /(successfully )?deploy(ed|ment)/i.test(text),
    title: 'High-gain antenna deployed',
  },
  {
    milestone: 'aperture_cover_deploy',
    status: 'complete',
    matches: (text) => /(deployable aperture cover|visor-like sunshade|aperture cover)/i.test(text) && /(successfully )?(deploy(ed|ment)|completed)/i.test(text),
    title: 'Deployable aperture cover deployed',
  },
  {
    milestone: 'coronagraph_power_on',
    status: 'complete',
    matches: (text) => /coronagraph instrument/i.test(text) && /(successfully activated|powered on|power on)/i.test(text),
    title: 'Coronagraph Instrument powered on',
  },
  {
    milestone: 'wfi_power_on',
    status: 'complete',
    matches: (text) => /(wide field instrument|\bWFI\b)/i.test(text) && /(successfully activated|powered on|power on)/i.test(text),
    title: 'Wide Field Instrument powered on',
  },
  {
    milestone: 'mcc2',
    status: 'not_required',
    matches: (text) => /(second|#2).{0,40}mid-course correction/i.test(text) && /(not required|not needed|unnecessary)/i.test(text),
    title: 'Second mid-course correction not required',
  },
  {
    milestone: 'mcc2',
    status: 'complete',
    matches: (text) => /(second|#2).{0,40}mid-course correction/i.test(text) && /(completed|complete|burn)/i.test(text),
    title: 'Second mid-course correction complete',
  },
  {
    milestone: 'l2',
    status: 'complete',
    matches: (text) => /(L2|second Lagrange point)/i.test(text) && /(orbit insertion|entered|arrived|insertion burn)/i.test(text) && /(complete|completed|success)/i.test(text),
    title: 'L2 orbit insertion complete',
  },
  {
    milestone: 'science',
    status: 'complete',
    matches: (text) => /(first[- ]look|first images|science operations)/i.test(text) && /(released|began|begin|started|start)/i.test(text),
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
      occurredAt: item.publishedAt,
      publishedAt: item.publishedAt,
      title: rule.title,
      summary: item.title,
      source: item.url,
      sourceType: 'nasa-roman-rss',
    }))
}

function latestEvent(events, milestone) {
  return events
    .filter((event) => event.milestone === milestone)
    .sort((a, b) => new Date(b.occurredAt ?? b.publishedAt ?? 0) - new Date(a.occurredAt ?? a.publishedAt ?? 0))[0]
}

const mission = await readJson('data/mission.json')
const milestones = await readJson('data/milestones.json')
const events = await readJson('data/events.json')
const sourceState = await readJson('data/source-state.json')

const response = await fetch(mission.blogFeed, {
  headers: { 'user-agent': 'roman-mission-monitor/0.1 (+https://github.com/rmlowe/roman-mission-monitor)' },
})
if (!response.ok) throw new Error(`Roman RSS fetch failed: ${response.status} ${response.statusText}`)

const items = parseRss(await response.text())
if (!items.length) throw new Error('Roman RSS feed contained no items')

const knownIds = new Set(events.map((event) => event.id))
for (const item of items) {
  for (const event of recognize(item)) {
    if (!knownIds.has(event.id)) {
      events.push(event)
      knownIds.add(event.id)
      console.log(`Detected: ${event.title} (${item.url})`)
    }
  }
}

sourceState.romanBlog.lastSeenItemUrl = items[0].url

const now = Date.now()
const renderedMilestones = milestones.map((milestone) => {
  const event = latestEvent(events, milestone.id)
  let status = event?.status ?? milestone.defaultStatus
  if (!event && milestone.staleAfter && now > new Date(milestone.staleAfter).getTime()) {
    status = 'awaiting_confirmation'
  }
  return {
    id: milestone.id,
    title: milestone.title,
    timing: milestone.timing,
    actualAt: event?.occurredAt ?? milestone.actualAt,
    status,
    description: milestone.description,
    source: event?.source ?? milestone.source,
    ...(milestone.staleAfter ? { staleAfter: milestone.staleAfter } : {}),
  }
})

const latest = [...events].sort(
  (a, b) => new Date(b.occurredAt ?? b.publishedAt ?? 0) - new Date(a.occurredAt ?? a.publishedAt ?? 0),
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
