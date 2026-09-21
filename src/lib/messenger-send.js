// Facebook Send API 呼叫封裝。刻意不做 24 小時視窗判斷——SKILL.md「待確認
// 事項」已經記錄這件事，正式上線前要補，這裡先讓最小可行路徑動起來。
const GRAPH_API_VERSION = 'v21.0';

export async function sendText(pageAccessToken, psid, text) {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages?access_token=${encodeURIComponent(pageAccessToken)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ recipient: { id: psid }, message: { text } }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Messenger Send API 失敗（HTTP ${res.status}）：${body}`);
  }
}

export async function sendMedia(pageAccessToken, psid, mediaType, url) {
  const attachmentType = mediaType === 'file' ? 'file' : mediaType;
  const apiUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages?access_token=${encodeURIComponent(pageAccessToken)}`;
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: psid },
      message: { attachment: { type: attachmentType, payload: { url, is_reusable: true } } },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Messenger Send API 失敗（HTTP ${res.status}）：${body}`);
  }
}
