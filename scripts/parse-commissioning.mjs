import crypto from 'node:crypto'

const decodeHtml = (value = '') =>
  value
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replaceAll('&apos;', "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))

const stripHtml = (value = '') =>
  decodeHtml(value)
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeHeading = (value) => stripHtml(value).replace(/[’]/g, "'").trim()

const sectionId = (heading) =>
  heading
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const wantedSections = new Set(['where-is-roman', 'deployments', 'romans-orbit'])

function extractSections(html) {
  const headings = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)]
  const sections = []

  for (let index = 0; index < headings.length; index += 1) {
    const match = headings[index]
    const heading = normalizeHeading(match[1])
    const id = sectionId(heading)
    if (!wantedSections.has(id)) continue

    const start = match.index + match[0].length
    const end = headings[index + 1]?.index ?? html.length
    let text = stripHtml(html.slice(start, end))

    text = text
      .replace(/To view this video please enable JavaScript, and consider upgrading to a web browser that supports HTML5 video/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    sections.push({ id, heading, text })
  }

  return sections
}

function extractPageLastUpdated(html) {
  const text = stripHtml(html)
  const match = text.match(/Page Last Updated:\s*([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/i)
  if (!match) return undefined

  const parsed = new Date(`${match[1]} 00:00:00 UTC`)
  return Number.isNaN(parsed.getTime()) ? match[1] : parsed.toISOString().slice(0, 10)
}

export function parseCommissioningPage(html, { url, fetchedAt = new Date().toISOString() }) {
  const sections = extractSections(html)
  if (!sections.length) {
    throw new Error('Roman commissioning page contained none of the expected sections')
  }

  const missingSections = [...wantedSections].filter((id) => !sections.some((section) => section.id === id))
  if (missingSections.length) {
    throw new Error(`Roman commissioning page missing expected sections: ${missingSections.join(', ')}`)
  }

  const semanticContent = {
    pageLastUpdated: extractPageLastUpdated(html),
    sections,
  }
  const contentHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(semanticContent))
    .digest('hex')

  return {
    schemaVersion: 1,
    parserVersion: 'commissioning-v1',
    source: {
      id: 'roman-commissioning',
      url,
      fetchedAt,
      contentHash: `sha256:${contentHash}`,
      ...(semanticContent.pageLastUpdated ? { pageLastUpdated: semanticContent.pageLastUpdated } : {}),
    },
    sections,
  }
}
