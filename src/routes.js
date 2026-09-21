import express from 'express';
import { getConfig } from './lib/config.js';

// 這支路由收到的請求已經是 sharing-pro-ai platform 的全域 webhook gateway
// （/api/webhooks/facebook）驗過簽章、依 Page ID 分流過後才轉送進來的內容，
// 這裡刻意不再驗一次簽章——理由見 SKILL.md「跟其他頻道的刻意差異」。
export function registerRoutes(app, deps = {}) {
  const { sendToC4 = () => {}, logger = console } = deps;

  app.get('/health', (req, res) => {
    const cfg = getConfig();
    res.json({
      status: 'ok',
      service: 'zylos-facebook_messenger',
      uptime: Math.floor(process.uptime()),
      hasCredentials: !!(cfg.facebook_page_id && cfg.facebook_page_access_token),
    });
  });

  app.use('/facebook/webhook', express.json({ limit: '2mb' }));
  app.post('/facebook/webhook', (req, res) => {
    const payload = req.body;
    if (!payload || payload.object !== 'page' || !Array.isArray(payload.entry)) {
      return res.status(400).json({ error: 'invalid payload' });
    }

    for (const entry of payload.entry) {
      const messagingEvents = Array.isArray(entry.messaging) ? entry.messaging : [];
      for (const event of messagingEvents) {
        const psid = event.sender?.id;
        const text = event.message?.text;
        if (!psid || !text) continue; // 附件、已讀回條等非文字事件先略過
        sendToC4('facebook_messenger', psid, `[FB DM] ${psid} said: ${text}`);
      }
    }

    res.json({ ok: true });
  });

  return app;
}

export function createApp(deps = {}) {
  const app = express();
  registerRoutes(app, deps);
  return app;
}
