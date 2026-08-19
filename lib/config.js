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
export const Config = z.object({
    enabled: z.boolean().default(true),
    name: z.string().default('dsh-weixin-clawbot'),
    puppet: z.string().default('ilink'),
    puppetOptions: z.dict(z.any()).default({}),
    workspace: z.string().default(process.cwd()),
    model: z.string().default(''),
    dmPolicy: z.union(['open', 'pairing', 'allowlist', 'disabled']).default('pairing'),
    allowFrom: z.array(z.union([z.string(), z.number()])).default([]),
    groupPolicy: z.union(['open', 'allowlist', 'disabled']).default('allowlist'),
    groups: z.array(z.string()).default([]),
    groupRequireMention: z.boolean().default(true),
    autoAcceptFriend: z.boolean().default(false),
    mediaMaxMb: z.natural().default(30),
    mediaDir: z.string().default(''),
    noticeTools: z.boolean().default(true),
    replyOn: z.union(['step', 'turn']).default('step'),
    pairingNotice: z.string().default('OpenClaw: 你还没有访问权限。请让机器人主人把你的微信号加入 channels.wechat.dm.allowFrom（或改用 open 策略）。'),
    textChunkLimit: z.natural().default(3800),
});
/** 返回媒体保存目录：配置优先，其次 $DSH_HOME/wechat-media，最后 ~/.dsh/wechat-media。 */
export function resolveMediaDir(config) {
    if (config.mediaDir)
        return config.mediaDir;
    const home = process.env.DSH_HOME ?? (process.env.HOME ? `${process.env.HOME}/.dsh` : '/tmp/.dsh');
    return `${home}/wechat-media`;
}
