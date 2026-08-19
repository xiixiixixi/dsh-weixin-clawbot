/**
 * 入站访问策略纯函数：私聊 / 群聊的放行与拦截判断。
 *
 * @module dsh-weixin-clawbot/policy
 */
function normalizeList(list) {
    return list
        .map((entry) => String(entry).trim().toLowerCase())
        .filter(Boolean);
}
/** 匹配发送者：微信号 / 备注名 / `*` 通配。 */
export function resolveSenderMatch(params) {
    const list = normalizeList(params.allowFrom);
    if (list.length === 0)
        return { allowed: false };
    if (list.includes('*'))
        return { allowed: true, matchKey: '*', matchSource: 'wildcard' };
    const userId = params.userId?.trim().toLowerCase() ?? '';
    const userName = params.userName?.trim().toLowerCase() ?? '';
    for (const [value, source] of [
        [userId, 'id'],
        [userName, 'name'],
    ]) {
        if (value && list.includes(value)) {
            return { allowed: true, matchKey: value, matchSource: source };
        }
    }
    return { allowed: false };
}
/** 匹配群：群 id / 群名 / `*` 通配。 */
export function resolveGroupMatch(params) {
    const list = normalizeList(params.groups);
    if (list.length === 0)
        return { allowed: false };
    if (list.includes('*'))
        return { allowed: true, matchKey: '*', matchSource: 'wildcard' };
    const roomId = params.roomId?.trim().toLowerCase() ?? '';
    const roomTopic = params.roomTopic?.trim().toLowerCase() ?? '';
    if (roomId && list.includes(roomId)) {
        return { allowed: true, matchKey: roomId, matchSource: 'id' };
    }
    if (roomTopic && list.includes(roomTopic)) {
        return { allowed: true, matchKey: roomTopic, matchSource: 'name' };
    }
    return { allowed: false };
}
/** 私聊消息准入判断。 */
export function decideDm(config, sender, extraAllowFrom = []) {
    if (config.dmPolicy === 'disabled')
        return { allowed: false, reason: 'disabled' };
    if (config.dmPolicy === 'open')
        return { allowed: true };
    const match = resolveSenderMatch({
        allowFrom: [...config.allowFrom, ...extraAllowFrom],
        userId: sender.id,
        userName: sender.name,
    });
    if (match.allowed)
        return { allowed: true };
    return config.dmPolicy === 'pairing'
        ? { allowed: false, reason: 'pairing' }
        : { allowed: false, reason: 'blocked' };
}
/** 群消息准入判断。 */
export function decideGroup(config, params) {
    if (config.groupPolicy === 'disabled')
        return { allowed: false, reason: 'disabled' };
    if (config.groupPolicy === 'open') {
        if (config.groupRequireMention && !params.mentionSelf) {
            return { allowed: false, reason: 'no-mention' };
        }
        return { allowed: true };
    }
    const match = resolveGroupMatch({
        groups: config.groups,
        roomId: params.roomId,
        roomTopic: params.roomTopic,
    });
    if (!match.allowed)
        return { allowed: false, reason: 'not-listed' };
    if (config.groupRequireMention && !params.mentionSelf) {
        return { allowed: false, reason: 'no-mention' };
    }
    return { allowed: true };
}
/** 归一化微信 id：去掉 wechat: 前缀并小写。 */
export function normalizeWechatId(raw) {
    return raw.replace(/^wechat:/i, '').trim().toLowerCase();
}
