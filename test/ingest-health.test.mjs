import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, cp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

test('failed source fetch or parse preserves last published health', async () => {
  const root = await mkdtemp(join(tmpdir(), 'roman-health-'))
  try {
    await cp(new URL('../data', import.meta.url), join(root, 'data'), { recursive: true })
    const html = await readFile(new URL('./fixtures/roman-commissioning.html', import.meta.url), 'utf8')
    const script = new URL('../scripts/ingest-roman.mjs', import.meta.url).href
    const rss = '<rss><channel><item><title>Routine update</title><link>https://example.test/update</link><pubDate>Thu, 08 Oct 2026 12:00:00 GMT</pubDate><description>No new milestone.</description></item></channel></rss>'
    const run = mode => spawnSync(process.execPath, ['--input-type=module', '-e', `
      let call = 0;
      globalThis.fetch = async () => {
        const index = call++;
        return { ok: !(index === 1 && ${JSON.stringify(mode)} === 'http'), status: 403, statusText: 'Forbidden',
          text: async () => index === 0 ? ${JSON.stringify(rss)} : (${JSON.stringify(mode)} === 'parse' ? '<html>Changed layout</html>' : ${JSON.stringify(html)}) };
      };
      await import(${JSON.stringify(script)});
    `], { cwd: root, encoding: 'utf8' })
    const success = run('ok')
    assert.equal(success.status, 0, success.stderr)
    const before = await readFile(join(root, 'data/collection-health.json'), 'utf8')
    assert.ok(JSON.parse(before).lastSuccessfulCheckAt)
    for (const mode of ['http', 'parse']) {
      assert.notEqual(run(mode).status, 0)
      assert.equal(await readFile(join(root, 'data/collection-health.json'), 'utf8'), before)
    }
  } finally { await rm(root, { recursive: true, force: true }) }
})
