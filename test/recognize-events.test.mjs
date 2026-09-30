import assert from 'node:assert/strict'
import test from 'node:test'
import { recognize, discardLegacyScienceEvents } from '../scripts/recognize-events.mjs'

const detect = (text, title = '') => recognize({ title, text, url: 'https://example.test/update', publishedAt: '2026-09-14T00:00:00Z' })

for (const text of [
  'NASA denied science operations have begun.',
  'First-look images are released after commissioning.',
  'Reports suggest science operations have begun.',
  'NASA denied that the high-gain antenna has deployed.',
  'Science operations have begun?',
  'First-look images were released?',
  'The claim that science operations have begun is false.',
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
  ['First science images were released.', 'first_look'],
  ["NASA confirmed that Roman’s first-look images have been released.", 'first_look'],
  ['NASA has announced that science operations have begun.', 'science'],
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
  assert.equal(events[0].recognizerVersion, 4)
})

test('retracts ambiguous legacy science events, including those outside the feed', () => {
  const legacy = { milestone: 'science', sourceType: 'nasa-roman-rss', source: 'old-feed-item' }
  const previousScience = { ...legacy, recognizerVersion: 2 }
  const previousImages = { ...previousScience, milestone: 'first_look' }
  const confirmed = { ...legacy, recognizerVersion: 3 }
  const oldImages = { ...legacy, milestone: 'first_look', recognizerVersion: 3 }
  const confirmedImages = { ...oldImages, recognizerVersion: 4 }
  const seed = { ...legacy, sourceType: 'seed' }
  const other = { ...legacy, milestone: 'hga_deploy' }
  assert.deepEqual(discardLegacyScienceEvents([legacy, previousScience, previousImages, confirmed, oldImages, confirmedImages, seed, other]), [confirmed, confirmedImages, seed, other])
})

const wfiConfirmation = 'NASA’s Nancy Grace Roman Space Telescope team has successfully activated the Wide Field Instrument, a 300-megapixel infrared camera that will allow scientists to explore wide swaths of the cosmos very quickly without sacrificing exquisite detail.'

test('recognises NASA WFI activation despite future capability in relative clause', () => {
  const events = detect(wfiConfirmation, 'NASA Activates Roman’s Primary Instrument, Checks Out Coronagraph')
  assert.deepEqual(events.map(e => e.milestone), ['wfi_power_on'])
  assert.equal(events[0].occurredAt, undefined, 'publication is not an occurrence timestamp')
})

for (const text of [
  'First images were released.',
  'The first engineering test images were released.',
  'First science images will be released by early 2027.',
  'First science images have not been released.',
  'If ' + wfiConfirmation,
  'NASA denied that ' + wfiConfirmation,
  wfiConfirmation.replace('has successfully activated', 'will activate'),
  wfiConfirmation.replace('has successfully activated', 'has not successfully activated'),
  wfiConfirmation.replace('detail.', 'detail, but this claim is false.'),
  wfiConfirmation.replace('detail.', 'detail, if activation succeeds.'),
]) test(`does not broaden confirmation: ${text}`, () => assert.deepEqual(detect(text), []))
