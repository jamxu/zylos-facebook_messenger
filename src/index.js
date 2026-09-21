#!/usr/bin/env node
/**
 * zylos-facebook_messenger
 *
 * Facebook Messenger channel for Zylos agents
 */

import { getConfig, watchConfig, DATA_DIR } from './lib/config.js';
import { createApp } from './routes.js';
import { sendToC4 } from './lib/c4.js';

// Initialize
console.log(`[facebook_messenger] Starting...`);
console.log(`[facebook_messenger] Data directory: ${DATA_DIR}`);

// Load configuration
let config = getConfig();
console.log(`[facebook_messenger] Config loaded, enabled: ${config.enabled}`);

if (!config.enabled) {
  console.log(`[facebook_messenger] Component disabled in config, exiting.`);
  process.exit(0);
}

// Watch for config changes
watchConfig((newConfig) => {
  console.log(`[facebook_messenger] Config reloaded`);
  config = newConfig;
  if (!newConfig.enabled) {
    console.log(`[facebook_messenger] Component disabled, stopping...`);
    shutdown();
  }
});

let server = null;

// Main component logic
async function main() {
  const app = createApp({ sendToC4 });
  // TODO(facebook-channel): 對齊 SKILL.md http_routes 宣告的埠號（目前 3985
  // 是 sharing-pro-ai platform 端 /api/webhooks/facebook/route.ts 裡的暫定值）。
  const port = config.port || 3985;
  server = app.listen(port, '127.0.0.1', () => {
    console.log(`[facebook_messenger] Listening on 127.0.0.1:${port}`);
  });
}

// Graceful shutdown
function shutdown() {
  console.log(`[facebook_messenger] Shutting down...`);
  server?.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Run
main().catch(err => {
  console.error(`[facebook_messenger] Fatal error:`, err);
  process.exit(1);
});
