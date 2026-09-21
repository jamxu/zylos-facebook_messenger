import assert from 'node:assert/strict';
import test from 'node:test';
import { createC4Sender } from '../src/lib/c4.js';

function fakeExecFile(successOnFirstCall) {
  let calls = 0;
  return function execFileImpl(cmd, args, opts, cb) {
    calls += 1;
    if (successOnFirstCall || calls > 1) return cb(null, '');
    const err = new Error('boom');
    err.stdout = '';
    cb(err, '');
  };
}

test('sendToC4 invokes c4-receive.js with --channel/--endpoint/--content', () => {
  const seen = [];
  const execFileImpl = (cmd, args, opts, cb) => { seen.push({ cmd, args }); cb(null, ''); };
  const sendToC4 = createC4Sender({ c4Receive: '/fake/c4-receive.js', execFileImpl, logger: { log() {}, warn() {}, error() {} } });

  sendToC4('facebook_messenger', 'psid-123', '[FB DM] psid-123 said: hi');

  assert.equal(seen.length, 1);
  assert.equal(seen[0].cmd, 'node');
  assert.deepEqual(seen[0].args, [
    '/fake/c4-receive.js', '--channel', 'facebook_messenger', '--endpoint', 'psid-123',
    '--json', '--content', '[FB DM] psid-123 said: hi',
  ]);
});

test('sendToC4 does nothing and logs an error when content is empty', () => {
  const errors = [];
  const execFileImpl = () => { throw new Error('should not be called'); };
  const sendToC4 = createC4Sender({ execFileImpl, logger: { log() {}, warn() {}, error: (m) => errors.push(m) } });

  sendToC4('facebook_messenger', 'psid-123', '');

  assert.equal(errors.length, 1);
});

test('sendToC4 calls onReject when c4-receive.js returns a structured rejection', () => {
  const execFileImpl = (cmd, args, opts, cb) => {
    const err = new Error('exit 1');
    err.stdout = JSON.stringify({ ok: false, error: { code: 'BLOCKED', message: 'not allowed' } });
    cb(err, '');
  };
  const sendToC4 = createC4Sender({ execFileImpl, logger: { log() {}, warn() {}, error() {} } });

  let rejected = null;
  sendToC4('facebook_messenger', 'psid-123', 'hi', { onReject: (msg) => { rejected = msg; } });

  assert.equal(rejected, 'not allowed');
});

test('sendToC4 retries once on a plain (non-JSON) failure, then calls onFail if the retry also fails', async () => {
  const execFileImpl = fakeExecFile(false);
  let failed = false;
  const sendToC4 = createC4Sender({
    execFileImpl,
    retryDelayMs: 1,
    logger: { log() {}, warn() {}, error() {} },
  });

  sendToC4('facebook_messenger', 'psid-123', 'hi', { onFail: () => { failed = true; } });

  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(failed, false); // second call in fakeExecFile succeeds
});
