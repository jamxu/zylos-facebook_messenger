import assert from 'node:assert/strict';
import test from 'node:test';
import { sendText, sendMedia } from '../src/lib/messenger-send.js';

function withMockFetch(impl, fn) {
  const original = global.fetch;
  global.fetch = impl;
  return fn().finally(() => { global.fetch = original; });
}

test('sendText posts recipient/message to the Graph API with the access token in the query string', async () => {
  let captured = null;
  await withMockFetch(
    async (url, opts) => {
      captured = { url, body: JSON.parse(opts.body) };
      return { ok: true };
    },
    () => sendText('page-token', 'psid-1', 'hello there')
  );

  assert.match(captured.url, /^https:\/\/graph\.facebook\.com\/v\d+\.\d+\/me\/messages\?access_token=page-token$/);
  assert.deepEqual(captured.body, { recipient: { id: 'psid-1' }, message: { text: 'hello there' } });
});

test('sendText throws with the response body when the Graph API call fails', async () => {
  await assert.rejects(
    () => withMockFetch(
      async () => ({ ok: false, status: 400, text: async () => 'invalid token' }),
      () => sendText('bad-token', 'psid-1', 'hi')
    ),
    /HTTP 400.*invalid token/s
  );
});

test('sendMedia sends an attachment payload with the given type and url', async () => {
  let captured = null;
  await withMockFetch(
    async (url, opts) => {
      captured = { url, body: JSON.parse(opts.body) };
      return { ok: true };
    },
    () => sendMedia('page-token', 'psid-1', 'image', 'https://example.com/photo.png')
  );

  assert.deepEqual(captured.body, {
    recipient: { id: 'psid-1' },
    message: { attachment: { type: 'image', payload: { url: 'https://example.com/photo.png', is_reusable: true } } },
  });
});

test('sendMedia throws when the Graph API call fails', async () => {
  await assert.rejects(
    () => withMockFetch(
      async () => ({ ok: false, status: 500, text: async () => 'server error' }),
      () => sendMedia('page-token', 'psid-1', 'file', 'https://example.com/doc.pdf')
    ),
    /HTTP 500.*server error/s
  );
});
