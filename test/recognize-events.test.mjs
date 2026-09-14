import assert from 'node:assert/strict'
import test from 'node:test'
import { recognize, discardLegacyScienceEvents } from '../scripts/recognize-events.mjs'

const detect = (text, title = '') => recognize({ title, text, url: 'https://example.test/update', publishedAt: '2026-09-14T00:00:00Z' })

for (const text of [
  'First-look images will be released after commissioning.',
  'First-look images have not been released.',
  'First-look images were never released.',
  'Science operations have not begun.',
  'Science operations will have begun by January.',
  'Science operations might have started.',
  'If science operations have begun, the team will report it.',
  'The high-gain antenna has not deployed.',
  'The high-gain antenna will be deployed.',
  'The spacecraft has not entered L2 orbit.',
  'The second mid-course correction may be not required.',
]) test(`does not confirm: ${text}`, () => assert.deepEqual(detect(text), []))

for (const [text, milestone, status = 'complete'] of [
  ['First-look images have been released.', 'first_look'],
  ['First images were released.', 'first_look'],
  ['Science operations have begun.', 'science'],
  ['Science operations are underway.', 'science'],
  ['The high-gain antenna has successfully deployed.', 'hga_deploy'],
  ['The Coronagraph Instrument has been successfully activated.', 'coronagraph_power_on'],
  ['The Wide Field Instrument has powered on.', 'wfi_power_on'],
  ['Roman has entered L2 orbit.', 'l2'],
  ['The second mid-course correction is not required.', 'mcc2', 'not_required'],
  ['The second mid-course correction was successfully completed.', 'mcc2'],
]) test(`confirms only ${milestone}: ${text}`, () => {
  assert.deepEqual(detect(text).map(e => [e.milestone, e.status]), [[milestone, status]])
})

test('future sentence does not suppress an independent confirmation', () => {
  assert.deepEqual(detect('First-look images have been released. Science operations will begin later.').map(e => e.milestone), ['first_look'])
})
test('headline and body cannot combine into a confirmation', () => {
  assert.deepEqual(detect('Released after commissioning is the plan.', 'First-look images'), [])
})
test('repeated confirmation produces one event with source evidence', () => {
  const events = detect('Science operations have begun.', 'Science operations have begun')
  assert.equal(events.length, 1)
  assert.equal(events[0].source, 'https://example.test/update')
  assert.equal(events[0].publishedAt, '2026-09-14T00:00:00Z')
  assert.equal(events[0].recognizerVersion, 2)
})

test('retracts ambiguous legacy science events, including those outside the feed', () => {
  const legacy = { milestone: 'science', sourceType: 'nasa-roman-rss', source: 'old-feed-item' }
  const confirmed = { ...legacy, recognizerVersion: 2 }
  const seed = { ...legacy, sourceType: 'seed' }
  const other = { ...legacy, milestone: 'hga_deploy' }
  assert.deepEqual(discardLegacyScienceEvents([legacy, confirmed, seed, other]), [confirmed, seed, other])
})
