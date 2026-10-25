import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const project = 'personal-wish-list-bot'
const hasGateway = true
const legacy = ["nginx-container", "nestjs-container"]
const script = fileURLToPath(new URL('./deploy-production.sh', import.meta.url))
function run(overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'production-deploy-'))
  try {
    mkdirSync(join(dir, 'scripts'))
    mkdirSync(join(dir, 'bin'))
    copyFileSync(script, join(dir, 'scripts/deploy-production.sh'))
    writeFileSync(join(dir, '.env.runtime'), '')
    writeFileSync(join(dir, '.release.env'), 'APP_IMAGE=example.test/app:release\n')
    writeFileSync(join(dir, 'service-account.prod.json'), '{}')
    writeFileSync(join(dir, 'bin/flock'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
    writeFileSync(join(dir, 'bin/sleep'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
    writeFileSync(join(dir, 'bin/curl'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
    writeFileSync(join(dir, 'bin/docker'), `#!${process.execPath}
const fs = require('node:fs'); const a = process.argv.slice(2);
fs.appendFileSync(process.env.CALLS, JSON.stringify(a)+'\\n');
if (a[0] === 'run' && process.env.FAIL_VALIDATE === '1') process.exit(1);
if (a[0] === 'inspect') {
  if (a.includes('{{.State.Health.Status}}')) console.log(process.env.FAIL_HEALTH === '1' ? 'unhealthy' : 'healthy');
  else if (a.includes('{{.State.Running}}')) console.log(a.at(-1) === 'gateway-id' || process.env.LEGACY_RUNNING === '1' ? 'true' : 'false');
  else if (process.env.LEGACY_RUNNING !== '1') process.exit(1);
}
if (a[0] === 'compose' && a.includes('ps')) console.log(a.at(-1) === 'app' ? 'app-id' : process.env.GATEWAY_RUNNING === '1' ? 'gateway-id' : '');
if (a[0] === 'cp') { console.error('Could not find the file in container'); process.exit(1); }
`, { mode: 0o755 })
    const p = spawnSync('bash', [join(dir, 'scripts/deploy-production.sh')], {
      env: { ...process.env, PATH: join(dir, 'bin') + ':' + process.env.PATH,
        CALLS: join(dir, 'calls.jsonl'), ...overrides }, encoding: 'utf8', timeout: 30000,
    })
    const calls = readFileSync(join(dir, 'calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
    return { ...p, calls }
  } finally { rmSync(dir, { recursive: true, force: true }) }
}

test('updates only its own project and never prunes or shuts down another app', () => {
  const p = run({ GATEWAY_RUNNING: '1' })
  assert.equal(p.status, 0, p.stderr)
  for (const a of p.calls) {
    assert.ok(!a.includes('prune') && !a.includes('down') && !a.includes('rm'), JSON.stringify(a))
    if (a[0] === 'compose') assert.equal(a[a.indexOf('--project-name') + 1], project)
  }
  if (hasGateway) {
    assert.ok(p.calls.some(a => a.includes('exec') && a.includes('reload')))
    assert.ok(!p.calls.some(a => a.includes('up') && a.at(-1) === 'gateway'))
  } else {
    assert.ok(!p.calls.some(a => a.includes('gateway') || a.includes('reload') || a.includes('volume')))
  }
})

test('first install starts only the gateway owned by this repository', () => {
  const p = run()
  assert.equal(p.status, 0, p.stderr)
  assert.equal(p.calls.some(a => a.includes('up') && a.at(-1) === 'gateway'), hasGateway)
})

if (hasGateway) test('invalid gateway config fails before stopping any live legacy container', () => {
  const p = run({ FAIL_VALIDATE: '1', LEGACY_RUNNING: '1' })
  assert.notEqual(p.status, 0)
  assert.ok(!p.calls.some(a => a[0] === 'stop' || a.includes('up')))
})

test('an unhealthy app fails deployment and restores only this project legacy containers', () => {
  const p = run({ FAIL_HEALTH: '1', LEGACY_RUNNING: '1' })
  assert.notEqual(p.status, 0)
  const restarted = p.calls.filter(a => a[0] === 'start').map(a => a[1])
  assert.deepEqual(restarted, [...legacy].reverse())
  if (legacy.length) {
    const stopNew = p.calls.findIndex(a => a[0] === 'compose' && a.includes('stop') && a.includes('app'))
    const restartOld = p.calls.findIndex(a => a[0] === 'start')
    assert.ok(stopNew >= 0 && stopNew < restartOld, 'stop new services before releasing legacy ports')
  }
})
