import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/routes.js';

async function withServer(deps, fn) {
  const app = createApp(deps);
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

test('GET /health returns ok without requiring credentials', async () => {
  await withServer({}, async (base) => {
    const res = await fetch(`${base}/health`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.hasCredentials, false);
  });
});

test('POST /facebook/webhook forwards each text message to C4 as "[FB DM] <psid> said: <text>"', async () => {
  const forwarded = [];
  const sendToC4 = (source, endpoint, content) => forwarded.push({ source, endpoint, content });

  await withServer({ sendToC4 }, async (base) => {
    const res = await fetch(`${base}/facebook/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        object: 'page',
        entry: [{ id: '111', messaging: [{ sender: { id: 'psid-1' }, message: { text: 'hi there' } }] }],
      }),
    });
    assert.equal(res.status, 200);
  });

  assert.equal(forwarded.length, 1);
  assert.deepEqual(forwarded[0], { source: 'facebook_messenger', endpoint: 'psid-1', content: '[FB DM] psid-1 said: hi there' });
});

test('POST /facebook/webhook forwards multiple messaging events in one entry, each separately', async () => {
  const forwarded = [];
  const sendToC4 = (source, endpoint, content) => forwarded.push({ endpoint, content });

  await withServer({ sendToC4 }, async (base) => {
    await fetch(`${base}/facebook/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        object: 'page',
        entry: [{
          id: '111',
          messaging: [
            { sender: { id: 'psid-1' }, message: { text: 'first' } },
            { sender: { id: 'psid-2' }, message: { text: 'second' } },
          ],
        }],
      }),
    });
  });

  assert.equal(forwarded.length, 2);
  assert.equal(forwarded[0].endpoint, 'psid-1');
  assert.equal(forwarded[1].endpoint, 'psid-2');
});

test('POST /facebook/webhook skips events with no text (e.g. attachments, read receipts) without erroring', async () => {
  const forwarded = [];
  const sendToC4 = (source, endpoint, content) => forwarded.push({ endpoint, content });

  await withServer({ sendToC4 }, async (base) => {
    const res = await fetch(`${base}/facebook/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        object: 'page',
        entry: [{ id: '111', messaging: [{ sender: { id: 'psid-1' }, delivery: { mids: ['m1'] } }] }],
      }),
    });
    assert.equal(res.status, 200);
  });

  assert.equal(forwarded.length, 0);
});

test('POST /facebook/webhook rejects a payload that is not a page object', async () => {
  await withServer({}, async (base) => {
    const res = await fetch(`${base}/facebook/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ object: 'user', entry: [] }),
    });
    assert.equal(res.status, 400);
  });
});
