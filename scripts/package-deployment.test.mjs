import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
const script = fileURLToPath(new URL('./package-deployment.sh', import.meta.url))
const workflow = readFileSync(new URL('../.github/workflows/production-deploy.yml', import.meta.url), 'utf8')

test('config transfer and deployment use one SSH action with password authentication', () => {
  assert.equal((workflow.match(/uses: appleboy\/ssh-action@/g) || []).length, 1)
  assert.ok(!workflow.includes('appleboy/scp-action'))
  assert.match(workflow, /password: \$\{\{ secrets\.PROD_\w+_PASSWORD \}\}/)
  assert.ok(workflow.includes('envs: REGISTRY_USER,REGISTRY_TOKEN,DEPLOYMENT_ARCHIVE'))
  assert.ok(workflow.includes('printf \'%s\' "$DEPLOYMENT_ARCHIVE" | base64 --decode > deployment.tgz'))
})

test('the packet round-trips secrets and is masked before it is exported', () => {
  const dir = mkdtempSync(join(tmpdir(), 'deployment-packet-'))
  try {
    mkdirSync(join(dir, '.deploy'))
    const secret = 'fixture-secret-\'with-quotes\nsecond-line\n'
    writeFileSync(join(dir, '.deploy/.env.runtime'), secret)
    const env = join(dir, 'runner-env')
    const p = spawnSync('bash', [script], { cwd: dir, env: { ...process.env, GITHUB_ENV: env }, encoding: 'utf8' })
    assert.equal(p.status, 0, p.stderr)
    const record = readFileSync(env, 'utf8').trim()
    assert.ok(record.startsWith('DEPLOYMENT_ARCHIVE='))
    const payload = record.slice('DEPLOYMENT_ARCHIVE='.length)
    assert.equal(p.stdout, '::add-mask::' + payload + '\n')
    assert.ok(!p.stdout.includes(secret))
    mkdirSync(join(dir, 'received'))
    const unpack = spawnSync('tar', ['-xz', '-C', join(dir, 'received')], { input: Buffer.from(payload, 'base64') })
    assert.equal(unpack.status, 0)
    assert.equal(readFileSync(join(dir, 'received/.env.runtime'), 'utf8'), secret)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('an oversized packet fails before exporting or printing its encoded secret', () => {
  const dir = mkdtempSync(join(tmpdir(), 'deployment-packet-'))
  try {
    mkdirSync(join(dir, '.deploy'))
    writeFileSync(join(dir, '.deploy/random'), randomBytes(70000))
    const env = join(dir, 'runner-env')
    const p = spawnSync('bash', [script], { cwd: dir, env: { ...process.env, GITHUB_ENV: env }, encoding: 'utf8' })
    assert.notEqual(p.status, 0)
    assert.equal(p.stdout, '')
    assert.match(p.stderr, /transport limit/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
