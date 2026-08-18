/**
 * DeepSeek Harness 微信远程控制插件。
 *
 * 在 cordis.yml 中挂载即可用微信远程对话/控制运行中的 DSH agent：
 *
 * ```yaml
 * - id: wechat
 *   name: dsh-wechat
 *   config:
 *     puppet: wechaty-puppet-wechat
 *     dmPolicy: pairing
 *     groupPolicy: allowlist
 *     groups: ["xxx@chatroom"]
 * ```
 *
 * @module dsh-wechat
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent-default-model'
import type {} from '@deepseek-ai/dsh-session'

import { WechatBackend } from './backend.js'
import { Config, type WechatConfig } from './config.js'

export { Config, resolveMediaDir, type WechatConfig, type DmPolicy, type GroupPolicy } from './config.js'
export {
  decideDm,
  decideGroup,
  normalizeWechatId,
  resolveGroupMatch,
  resolveSenderMatch,
} from './policy.js'
export {
  HELP_TEXT,
  chunkForWechat,
  extractAssistantText,
  mediaPlaceholder,
  parseControlCommand,
  turnEndSummary,
} from './format.js'
export {
  isWechatSession,
  sendTargetFromSessionId,
  sessionIdFor,
  subjectFromSessionId,
  WECHAT_SESSION_PREFIX,
  type WechatSubject,
} from './sessions.js'
export { WechatBackend } from './backend.js'

export const name = 'dsh-wechat'

export const inject = ['agents', 'sessions', 'agentDefaultModel'] as const

export function apply(ctx: Context, config: WechatConfig): void {
  const backend = new WechatBackend(ctx, config)
  void backend.start().catch((error: unknown) => {
    ctx.logger.error(`dsh-wechat: 启动失败: ${String(error)}`)
  })
  ctx.effect(() => () => {
    void backend.dispose()
  })
}
