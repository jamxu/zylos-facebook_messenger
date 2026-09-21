---
name: facebook_messenger
version: 0.1.0
description: >-
  Facebook Messenger channel for Zylos. Receives page events forwarded by the
  sharing-pro-ai platform's global webhook gateway (signature already
  verified upstream), routes inbound messages through C4, and sends replies
  through the Messenger Send API.
type: communication

lifecycle:
  npm: true
  service:
    type: pm2
    name: zylos-facebook_messenger
    entry: src/index.js
  data_dir: ~/zylos/components/facebook_messenger
  hooks:
    configure: hooks/configure.js
    post-install: hooks/post-install.js
    pre-upgrade: hooks/pre-upgrade.js
    post-upgrade: hooks/post-upgrade.js
  preserve:
    - config.json
    - logs/

# 這個路由是給 pod 內部呼叫用的（sharing-pro-ai platform 用 kubectl exec 轉送
# 到 127.0.0.1，見該 repo 的 src/app/api/webhooks/facebook/route.ts），不是給
# Meta 直接打進來的公開端點，所以這裡不需要 strip_prefix 那套瀏覽器 base 邏輯。
http_routes:
  - path: /facebook/webhook
    target: http://localhost:3985
    type: reverse_proxy

upgrade:
  repo: jamxu/zylos-facebook_messenger
  branch: main

config:
  required:
    - name: FACEBOOK_PAGE_ID
      description: Facebook Page ID（用於組出 Send API 的呼叫網址）
      sensitive: false
    - name: FACEBOOK_PAGE_ACCESS_TOKEN
      description: Facebook Page Access Token（用於送出回覆）
      sensitive: true

dependencies:
  - comm-bridge
---

# Facebook Messenger

Facebook Messenger channel component for Zylos.

## 跟其他頻道的刻意差異：不驗簽章

LINE 等其他頻道的元件通常自己也會拿一份密鑰再驗一次 webhook 簽章（defense in
depth）。這個元件**刻意不這麼做**：

- Facebook 的簽章密鑰（App Secret）是**整個 Meta App 共用**的，不是每個粉專
  各自的密鑰。如果每個安裝了這個元件的 pod 都拿一份 App Secret，等於同一組
  密鑰散布在所有客戶的 pod 裡，任一 pod 被攻破都會讓其他所有客戶的 Messenger
  頻道一起暴露。
- 簽章驗證已經在 sharing-pro-ai platform 的全域 webhook gateway
  （`/api/webhooks/facebook`）做過一次，這個元件收到的請求已經是驗證通過、
  且已經依 Page ID 分流過的內容。
- 因此 `config.required` 只有 `FACEBOOK_PAGE_ID` 和
  `FACEBOOK_PAGE_ACCESS_TOKEN`，沒有 App Secret。

## Configuration

Runtime config is stored at `~/zylos/components/facebook_messenger/config.json`.

## Sending

```bash
node scripts/send.js '<psid>' 'hello'
echo '[MEDIA:image] https://example.com/photo.png' | node scripts/send.js '<psid>'
```

## 待確認事項（寫給接手實作/驗證的人）

1. **24 小時訊息視窗**：使用者私訊後才會開啟 24 小時視窗，視窗外只能用官方
   核准的 message tag 或 7 天內的 `HUMAN_AGENT` tag。目前 `scripts/send.js`
   還沒實作這層檢查，直接送出——正式上線前要補。
2. **PSID 並發隔離**：同一個粉專可能同時被多個不同 PSID 使用者私訊；C4 的
   `--endpoint` 參數就是拿來區分對話的（見 `src/lib/c4.js`），這點跟早期評估
   過、已證實有並發配對 bug 的 platform 端 `sendMessageToPod`/`pollZylos`
   模型不同，不要混用那套邏輯。
3. **內部埠號**：`http_routes` 目前寫 `3985`，是 platform 端
   `/api/webhooks/facebook/route.ts` 裡的暫定值，兩邊要對齊，不要各自認定。
4. **`zylos add facebook_messenger --yes`**：platform 端的 `channel-connector.ts`
   已經照這個 `name:` 寫好呼叫，如果之後改名記得同步通知平台端。
5. **Graph API 版本**：`src/lib/messenger-send.js` 裡的版本號是寫這份骨架時
   的暫定值，上線前要對照 Meta 當時的文件確認是否仍是建議版本。
