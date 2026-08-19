/**
 * DeepSeek Harness 微信远程控制插件。
 *
 * 在 cordis.yml 中挂载即可用微信远程对话/控制运行中的 DSH agent：
 *
 * ```yaml
 * - id: wechat
 *   name: dsh-weixin-clawbot
 *   config:
 *     puppet: wechaty-puppet-wechat
 *     dmPolicy: pairing
 *     groupPolicy: allowlist
 *     groups: ["xxx@chatroom"]
 * ```
 *
 * @module dsh-weixin-clawbot
 */
import type { Context } from '@deepseek-ai/cordis';
import { type WechatConfig } from './config.js';
export { Config, resolveMediaDir, type WechatConfig, type DmPolicy, type GroupPolicy } from './config.js';
export { decideDm, decideGroup, normalizeWechatId, resolveGroupMatch, resolveSenderMatch, } from './policy.js';
export { HELP_TEXT, chunkForWechat, extractAssistantText, mediaPlaceholder, parseControlCommand, turnEndSummary, } from './format.js';
export { isWechatSession, sendTargetFromSessionId, sessionIdFor, subjectFromSessionId, WECHAT_SESSION_PREFIX, type WechatSubject, } from './sessions.js';
export { WechatBackend } from './backend.js';
export type { AgentPresetsLike, WorkspaceRegistryLike } from './backend.js';
export { granularityFromConfig, loadState, noticeToolsOf, replyOnOf, resolveStatePath, saveState, validateSettingsInput, type Granularity, type RuntimeOverrides, type WorkspaceLite, type WorkspaceScope, } from './state.js';
export declare const name = "dsh-weixin-clawbot";
export declare const inject: readonly ["agents", "sessions", "agentDefaultModel"];
/** Web GUI 扫码窗口轮询的二维码/登录状态端点。 */
export declare const QRCODE_ROUTE_PATH = "/wechat/qrcode";
export declare function apply(ctx: Context, config: WechatConfig): void;
