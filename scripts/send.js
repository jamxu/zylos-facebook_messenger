#!/usr/bin/env node
/**
 * C4 Communication Bridge Interface for zylos-facebook_messenger
 *
 * This file provides the standard interface for Claude to send messages
 * through this communication component.
 *
 * Usage:
 *   node scripts/send.js <endpoint_id> "message text"
 *   node scripts/send.js <endpoint_id> "[MEDIA:image]/path/to/image.png"
 *   node scripts/send.js <endpoint_id> "[MEDIA:file]/path/to/document.pdf"
 *
 * Exit codes:
 *   0 - Success
 *   1 - Error (message printed to stderr)
 */

import { getConfig } from '../src/lib/config.js';
import { sendText as sendMessengerText, sendMedia as sendMessengerMedia } from '../src/lib/messenger-send.js';

// Parse arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: send.js <endpoint_id> <message>');
  console.error('       send.js <endpoint_id> "[MEDIA:image]/path/to/image.png"');
  console.error('       send.js <endpoint_id> "[MEDIA:file]/path/to/file.pdf"');
  process.exit(1);
}

const endpointId = args[0];
const message = args.slice(1).join(' ');

// Parse media prefix
const mediaMatch = message.match(/^\[MEDIA:(\w+)\](.+)$/);

async function send() {
  try {
    if (mediaMatch) {
      const [, mediaType, mediaPath] = mediaMatch;
      await sendMedia(endpointId, mediaType, mediaPath);
    } else {
      await sendText(endpointId, message);
    }
    process.exit(0);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Send a text message
 */
async function sendText(endpoint, text) {
  const cfg = getConfig();
  if (!cfg.facebook_page_access_token) {
    throw new Error('FACEBOOK_PAGE_ACCESS_TOKEN 未設定，請先完成頻道連結');
  }
  await sendMessengerText(cfg.facebook_page_access_token, endpoint, text);
}

/**
 * Send media (image, file, video, etc.)
 * mediaPath 目前只接受可公開存取的 URL——Messenger Send API 的附件是靠 URL
 * 抓取，本機檔案路徑要先另外上傳到可公開存取的地方才能用。
 */
async function sendMedia(endpoint, type, mediaPath) {
  const cfg = getConfig();
  if (!cfg.facebook_page_access_token) {
    throw new Error('FACEBOOK_PAGE_ACCESS_TOKEN 未設定，請先完成頻道連結');
  }
  await sendMessengerMedia(cfg.facebook_page_access_token, endpoint, type, mediaPath);
}

send();
