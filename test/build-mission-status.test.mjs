import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { buildMissionStatus } from '../scripts/build-mission-status.mjs'
import { recognize } from '../scripts/recognize-events.mjs'

const milestones = JSON.parse(await readFile(new URL('../data/milestones.json', import.meta.url)))
const events = JSON.parse(await readFile(new URL('../data/events.json', import.meta.url)))
const older = { title: 'Instrument activation', url: 'https://example.test/activation', publishedAt: '2026-09-15T17:59:00Z', summary: 'WFI activation confirmed.' }
const newer = { title: 'Ground stations ready', url: 'https://example.test/ground-stations', publishedAt: '2026-09-25T15:17:00Z', summary: 'Ground stations are ready for future science operations.' }
const args = { milestones, events, items: [older, newer], now: Date.parse('2026-09-30T07:00:00Z') }

test('latest news is independent of recognised milestones and feed ordering', () => {
  const result = buildMissionStatus(args)
  assert.deepEqual(result.mission.latestArticle, {
    title: newer.title, source: newer.url, summary: newer.summary, publishedAt: newer.publishedAt,
  })
  assert.notEqual(result.mission.latestSource, newer.url)
  assert.deepEqual(result, buildMissionStatus({ ...args, items: [newer, older] }))
  assert.deepEqual(result, buildMissionStatus({ ...args, now: args.now + 3600000 }), 'unchanged checks do not churn generated data')
})

test('NASA confirmation completes WFI without inventing an occurrence time', () => {
  const confirmed = recognize({ ...older, text: 'NASA’s Nancy Grace Roman Space Telescope team has successfully activated the Wide Field Instrument, a 300-megapixel infrared camera that will allow scientists to explore the cosmos.' })
  const result = buildMissionStatus({ ...args, events: [...events.filter(e => e.milestone !== 'wfi_power_on'), ...confirmed] })
  const wfi = result.milestones.find(m => m.id === 'wfi_power_on')
  assert.equal(wfi.status, 'complete')
  assert.equal(wfi.source, older.url)
  assert.equal(wfi.actualAt, undefined)
  assert.equal(result.mission.latestPublishedAt, older.publishedAt)
})

test('revised MCC2 plan expires without implying completion or cancellation', () => {
  const state = now => buildMissionStatus({ ...args, now: Date.parse(now) }).milestones.find(m => m.id === 'mcc2')
  assert.equal(state('2026-09-30T07:00:00Z').status, 'planned')
  assert.equal(state('2026-10-01T00:00:00Z').status, 'awaiting_confirmation')
  assert.match(state('2026-09-30T07:00:00Z').timing, /September/)
})

test('engineering image and news do not complete science milestones', () => {
  const result = buildMissionStatus(args)
  for (const id of ['first_look', 'science', 'l2']) {
    assert.equal(result.milestones.find(m => m.id === id).status, 'planned')
  }
  assert.equal(result.milestones.find(m => m.id === 'first_look').title, 'First science images')
})

test('news excerpt omits RSS attribution boilerplate and falls back to title', () => {
  const result = buildMissionStatus({ ...args, items: [{ ...newer, summary: newer.summary + ' The post Ground stations ready appeared first on NASA Science .' }] })
  assert.equal(result.mission.latestArticle.summary, newer.summary)
  assert.equal(buildMissionStatus({ ...args, items: [{ ...newer, summary: '' }] }).mission.latestArticle.summary, newer.title)
})
