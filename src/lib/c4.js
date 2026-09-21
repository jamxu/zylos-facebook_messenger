// C4（跨頻道通訊橋接）發送介面，照 zylos-line 的 src/lib/c4.js 移植——這是
// 目前唯一已驗證過、真的能把訊息送進 agent 對話的機制：透過 execFile 呼叫
// comm-bridge 元件自帶的 c4-receive.js，而不是自己發明一套新的傳遞方式。
import path from 'node:path';
import { execFile } from 'node:child_process';

export const DEFAULT_C4_RECEIVE = path.join(
  process.env.HOME || '',
  'zylos/.claude/skills/comm-bridge/scripts/c4-receive.js'
);

export function createC4Sender({
  c4Receive = DEFAULT_C4_RECEIVE,
  execFileImpl = execFile,
  retryDelayMs = 2000,
  logger = console
} = {}) {
  return function sendToC4(source, endpoint, content, callbacks = {}) {
    const { onReject, onFail } = typeof callbacks === 'function'
      ? { onReject: callbacks }
      : callbacks;

    if (!content) {
      logger.error('[facebook_messenger] sendToC4 called with empty content');
      return;
    }

    const args = [c4Receive, '--channel', source, '--endpoint', endpoint, '--json', '--content', content];
    execFileImpl('node', args, { encoding: 'utf8', timeout: 35000 }, (error, stdout) => {
      if (!error) {
        logger.log(`[facebook_messenger] Sent to C4: ${content.substring(0, 50)}...`);
        return;
      }

      let response = null;
      try { response = JSON.parse(error.stdout || stdout || ''); } catch { /* not JSON, ignore */ }
      if (response && response.ok === false && response.error?.message) {
        logger.warn(`[facebook_messenger] C4 rejected (${response.error.code}): ${response.error.message}`);
        if (onReject) onReject(response.error.message);
        return;
      }

      logger.warn(`[facebook_messenger] C4 send failed, retrying in ${retryDelayMs}ms: ${error.message}`);
      setTimeout(() => {
        execFileImpl('node', args, { encoding: 'utf8', timeout: 35000 }, retryError => {
          if (!retryError) return;
          logger.error(`[facebook_messenger] C4 send failed after retry: ${retryError.message}`);
          if (onFail) onFail();
        });
      }, retryDelayMs);
    });
  };
}

export const sendToC4 = createC4Sender();
