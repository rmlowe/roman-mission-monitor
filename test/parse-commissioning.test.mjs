import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

import { parseCommissioningPage } from '../scripts/parse-commissioning.mjs'

const fixtureUrl = new URL('./fixtures/roman-commissioning.html', import.meta.url)
const fixture = await fs.readFile(fixtureUrl, 'utf8')
const sourceUrl = 'https://science.nasa.gov/missions/roman-space-telescope/roman-commissioning/'

const parseFixture = (fetchedAt = '2026-09-04T05:30:00.000Z') =>
  parseCommissioningPage(fixture, { url: sourceUrl, fetchedAt })

test('extracts the expected semantic sections from the commissioning page', () => {
  const snapshot = parseFixture()

  assert.equal(snapshot.schemaVersion, 1)
  assert.equal(snapshot.parserVersion, 'commissioning-v2')
  assert.equal(snapshot.source.id, 'roman-commissioning')
  assert.equal(snapshot.source.url, sourceUrl)
  assert.equal(snapshot.source.pageLastUpdated, '2026-09-01')
  assert.match(snapshot.source.contentHash, /^sha256:[0-9a-f]{64}$/)

  assert.deepEqual(
    snapshot.sections.map(({ id, heading }) => ({ id, heading })),
    [
      { id: 'where-is-roman', heading: 'Where is Roman?' },
      { id: 'deployments', heading: 'Deployments' },
      { id: 'romans-orbit', heading: "Roman's Orbit" },
    ],
  )

  assert.match(snapshot.sections[0].text, /three-month journey from Earth to Sun-Earth Lagrange Point 2/)
  assert.match(snapshot.sections[1].text, /solar panels and sunshade deployed/)
  assert.match(snapshot.sections[2].text, /stable, halo orbit/)
  assert.ok(snapshot.sections.every(({ text }) => !text.includes('enable JavaScript')))
  assert.ok(snapshot.sections.every(({ text }) => !text.includes('Unable to render the provided source')))
})

test('semantic hash ignores fetch time', () => {
  const first = parseFixture('2026-09-04T05:30:00.000Z')
  const second = parseFixture('2026-09-04T06:30:00.000Z')

  assert.notEqual(first.source.fetchedAt, second.source.fetchedAt)
  assert.equal(first.source.contentHash, second.source.contentHash)
})

test('semantic hash changes when tracked content changes', () => {
  const first = parseFixture()
  const changed = parseCommissioningPage(
    fixture.replace('The solar panels and sunshade deployed', 'The solar panels, sunshade, and antenna deployed'),
    { url: sourceUrl, fetchedAt: '2026-09-04T05:30:00.000Z' },
  )

  assert.notEqual(first.source.contentHash, changed.source.contentHash)
})

test('fails loudly when an expected section disappears', () => {
  const missingOrbit = fixture.replace('<h2>Roman’s Orbit</h2>', '<h3>Roman’s Orbit</h3>')

  assert.throws(
    () => parseCommissioningPage(missingOrbit, { url: sourceUrl }),
    /missing expected sections: romans-orbit/,
  )
})
