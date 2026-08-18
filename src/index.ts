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
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-host-webserver'

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

/** Web GUI 扫码窗口轮询的二维码/登录状态端点。 */
export const QRCODE_ROUTE_PATH = '/wechat/qrcode'

export function apply(ctx: Context, config: WechatConfig): void {
  const backend = new WechatBackend(ctx, config)
  void backend.start().catch((error: unknown) => {
    ctx.logger.error(`dsh-wechat: 启动失败: ${String(error)}`)
  })

  // 提供二维码给浏览器：web profile 里有 webServer 服务时注册 HTTP 路由；
  // 没有（headless 等 profile）则等待服务出现，永不注册也不影响微信功能。
  ctx.inject(['webServer'], (webCtx) => {
    const route: WebRoute = {
      kind: 'exact',
      path: QRCODE_ROUTE_PATH,
      handler: (_req, res) => {
        res.writeHead(200, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        })
        res.end(JSON.stringify(backend.qrPayload()))
      },
    }
    webCtx.effect(() => webCtx.webServer.register(route), 'dsh-wechat: /wechat/qrcode route')
  })

  ctx.effect(() => () => {
    void backend.dispose()
  })
}
