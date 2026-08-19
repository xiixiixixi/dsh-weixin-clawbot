/**
 * 入站访问策略纯函数：私聊 / 群聊的放行与拦截判断。
 *
 * @module dsh-weixin-clawbot/policy
 */
import type { WechatConfig } from './config.js';
export type AllowlistMatch = {
    allowed: boolean;
    matchKey?: string;
    matchSource?: 'wildcard' | 'id' | 'name';
};
/** 匹配发送者：微信号 / 备注名 / `*` 通配。 */
export declare function resolveSenderMatch(params: {
    allowFrom: Array<string | number>;
    userId?: string;
    userName?: string;
}): AllowlistMatch;
/** 匹配群：群 id / 群名 / `*` 通配。 */
export declare function resolveGroupMatch(params: {
    groups: string[];
    roomId?: string;
    roomTopic?: string;
}): AllowlistMatch;
export type DmDecision = {
    allowed: true;
} | {
    allowed: false;
    reason: 'disabled' | 'blocked' | 'pairing';
};
/** 私聊消息准入判断。 */
export declare function decideDm(config: Pick<WechatConfig, 'dmPolicy' | 'allowFrom'>, sender: {
    id: string;
    name: string;
}, extraAllowFrom?: Array<string | number>): DmDecision;
export type GroupDecision = {
    allowed: true;
} | {
    allowed: false;
    reason: 'disabled' | 'no-mention' | 'not-listed';
};
/** 群消息准入判断。 */
export declare function decideGroup(config: Pick<WechatConfig, 'groupPolicy' | 'groups' | 'groupRequireMention'>, params: {
    roomId?: string;
    roomTopic?: string;
    mentionSelf: boolean;
}): GroupDecision;
/** 归一化微信 id：去掉 wechat: 前缀并小写。 */
export declare function normalizeWechatId(raw: string): string;
