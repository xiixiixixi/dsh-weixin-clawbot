/**
 * 弹窗运行时设置：颗粒度 / 工作区访问范围的类型、校验与持久化。
 *
 * cordis.patch.yml 里的静态配置是基准值；$DSH_HOME/dsh-weixin-clawbot.state.json
 * 存用户在弹窗里的运行时覆盖（原子写，读失败回退空对象）。
 *
 * @module dsh-weixin-clawbot/state
 */
import fs from 'node:fs';
import path from 'node:path';
/** state 文件路径：$DSH_HOME/dsh-weixin-clawbot.state.json（回退 ~/.dsh）。 */
export function resolveStatePath() {
    const home = process.env.DSH_HOME ?? (process.env.HOME ? `${process.env.HOME}/.dsh` : '/tmp/.dsh');
    return path.join(home, 'dsh-weixin-clawbot.state.json');
}
/** 一次性迁移旧包名（dsh-wechat）的 state 文件；新文件已存在则不动。 */
export function migrateLegacyStateFile(newFile) {
    const legacy = newFile.replace('dsh-weixin-clawbot.state.json', 'dsh-wechat.state.json');
    if (newFile === legacy || !fs.existsSync(legacy) || fs.existsSync(newFile))
        return;
    try {
        fs.copyFileSync(legacy, newFile);
    }
    catch {
        // 迁移失败按全新配置处理
    }
}
/** 从静态配置推导颗粒度（存量用户行为保持不变）。 */
export function granularityFromConfig(config) {
    if (config.replyOn === 'turn')
        return 'summary';
    return config.noticeTools ? 'detailed' : 'standard';
}
/** 颗粒度 → replyOn。 */
export function replyOnOf(granularity) {
    return granularity === 'summary' ? 'turn' : 'step';
}
/** 颗粒度 → noticeTools。 */
export function noticeToolsOf(granularity) {
    return granularity === 'detailed';
}
/** 读取运行时覆盖；文件缺失/损坏/多余字段一律安全回退。 */
export function loadState(file) {
    let raw;
    try {
        raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    catch {
        return {};
    }
    if (typeof raw !== 'object' || raw === null)
        return {};
    const record = raw;
    const result = {};
    if (record.granularity === 'detailed'
        || record.granularity === 'standard'
        || record.granularity === 'summary') {
        result.granularity = record.granularity;
    }
    if (record.workspaceScope === 'all') {
        result.workspaceScope = 'all';
    }
    else if (typeof record.workspaceScope === 'object'
        && record.workspaceScope !== null) {
        const scope = record.workspaceScope;
        // 兼容单选旧格式 { workspaceId } → { workspaceIds: [id] }
        if (typeof scope.workspaceId === 'string') {
            result.workspaceScope = { workspaceIds: [scope.workspaceId] };
        }
        else if (Array.isArray(scope.workspaceIds)
            && scope.workspaceIds.every((id) => typeof id === 'string')
            && scope.workspaceIds.length > 0) {
            result.workspaceScope = { workspaceIds: scope.workspaceIds };
        }
    }
    return result;
}
/** 原子写入运行时覆盖（临时文件 + rename），自动创建父目录。 */
export function saveState(file, overrides) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(overrides, null, 2)}\n`);
    fs.renameSync(tmp, file);
}
/**
 * 校验 POST /wechat/settings 的 body。
 * workspaceScope 指定具体工作区时，其 id 必须出现在当前工作区列表里。
 */
export function validateSettingsInput(body, workspaces) {
    if (typeof body !== 'object' || body === null) {
        return { ok: false, message: 'body 必须是 JSON 对象' };
    }
    const record = body;
    const patch = {};
    if ('granularity' in record) {
        if (record.granularity !== 'detailed'
            && record.granularity !== 'standard'
            && record.granularity !== 'summary') {
            return { ok: false, message: 'granularity 必须是 detailed / standard / summary' };
        }
        patch.granularity = record.granularity;
    }
    if ('workspaceScope' in record) {
        if (record.workspaceScope === 'all') {
            patch.workspaceScope = 'all';
        }
        else if (typeof record.workspaceScope === 'object'
            && record.workspaceScope !== null
            && Array.isArray(record.workspaceScope.workspaceIds)) {
            const raw = record.workspaceScope.workspaceIds;
            if (raw.length === 0
                || !raw.every((id) => typeof id === 'string')) {
                return { ok: false, message: 'workspaceIds 必须是非空字符串数组' };
            }
            const unknown = raw.filter((id) => !workspaces.some((workspace) => workspace.id === id));
            if (unknown.length > 0) {
                return { ok: false, message: `未知工作区: ${unknown.join(', ')}` };
            }
            patch.workspaceScope = { workspaceIds: raw };
        }
        else {
            return { ok: false, message: "workspaceScope 必须是 'all' 或 { workspaceIds: string[] }" };
        }
    }
    if (patch.granularity === undefined && patch.workspaceScope === undefined) {
        return { ok: false, message: '至少提供 granularity 或 workspaceScope 之一' };
    }
    return { ok: true, patch };
}
