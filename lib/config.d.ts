/**
 * 微信远程控制插件的配置模式。
 *
 * 挂载示例（cordis.yml）：
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
 * @module dsh-weixin-clawbot/config
 */
import z from '@deepseek-ai/schemastery';
export type DmPolicy = 'open' | 'pairing' | 'allowlist' | 'disabled';
export type GroupPolicy = 'open' | 'allowlist' | 'disabled';
export interface WechatConfig {
    /** 是否启用本插件。 */
    enabled: boolean;
    /** wechaty 实例名，日志与诊断标识。 */
    name: string;
    /** 微信接入后端：'ilink'（官方机器人通道，推荐）或 puppet 包名。 */
    puppet: string;
    /** 后端参数（token、appId、host 等）。 */
    puppetOptions: Record<string, unknown>;
    /** agent 的工作目录（会话 meta.cwd）。 */
    workspace: string;
    /** 模型 id；留空则使用 DSH 默认模型选择。 */
    model: string;
    /** 私聊访问策略。 */
    dmPolicy: DmPolicy;
    /** 私聊白名单：微信号 / 备注名 / `*`。 */
    allowFrom: Array<string | number>;
    /** 群策略。 */
    groupPolicy: GroupPolicy;
    /** 群白名单：群 id / 群名 / `*`。 */
    groups: string[];
    /** 群内是否需要 @机器人。 */
    groupRequireMention: boolean;
    /** 自动通过好友请求（仅支持该事件的后端）。 */
    autoAcceptFriend: boolean;
    /** 入站媒体大小上限（MB）。 */
    mediaMaxMb: number;
    /** 入站媒体保存目录；留空使用 $DSH_HOME/wechat-media。 */
    mediaDir: string;
    /** agent 调用工具时是否向微信发送提示。 */
    noticeTools: boolean;
    /** 回复时机：step（每步完成即发，默认）或 turn（整个回合结束发最终文本）。 */
    replyOn: 'step' | 'turn';
    /** 未授权私聊的配对提示文案。 */
    pairingNotice: string;
    /** 每条微信消息的文本上限（超出按段拆分发送）。 */
    textChunkLimit: number;
}
export declare const Config: z<WechatConfig>;
/** 返回媒体保存目录：配置优先，其次 $DSH_HOME/wechat-media，最后 ~/.dsh/wechat-media。 */
export declare function resolveMediaDir(config: Pick<WechatConfig, 'mediaDir'>): string;
