import fs from 'node:fs/promises'

import { parseCommissioningPage } from './parse-commissioning.mjs'

const mission = JSON.parse(await fs.readFile(new URL('../data/mission.json', import.meta.url), 'utf8'))
const response = await fetch(mission.commissioningPage, {
  headers: {
    'user-agent': 'roman-mission-monitor/0.1 (+https://github.com/rmlowe/roman-mission-monitor)',
  },
})

if (!response.ok) {
  throw new Error(
    `Roman commissioning fetch failed: ${response.status} ${response.statusText}`,
  )
}

const snapshot = parseCommissioningPage(await response.text(), {
  url: mission.commissioningPage,
})

console.log(`Parsed ${snapshot.sections.length} commissioning sections`)
console.log(`Page last updated: ${snapshot.source.pageLastUpdated ?? 'unknown'}`)
console.log(`Semantic hash: ${snapshot.source.contentHash}`)
for (const section of snapshot.sections) {
  console.log(`- ${section.heading}: ${section.text.slice(0, 120)}${section.text.length > 120 ? '…' : ''}`)
}
