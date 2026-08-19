/**
 * 弹窗运行时设置：颗粒度 / 工作区访问范围的类型、校验与持久化。
 *
 * cordis.patch.yml 里的静态配置是基准值；$DSH_HOME/dsh-weixin-clawbot.state.json
 * 存用户在弹窗里的运行时覆盖（原子写，读失败回退空对象）。
 *
 * @module dsh-weixin-clawbot/state
 */
import type { WechatConfig } from './config.js';
/** 回复颗粒度：详细程度三档（弹窗下拉）。 */
export type Granularity = 'detailed' | 'standard' | 'summary';
/** 工作区访问范围：所有工作区，或绑定到一组工作区 id（可多选）。 */
export type WorkspaceScope = 'all' | {
    workspaceIds: string[];
};
/** state 文件里的运行时覆盖；字段缺省 = 用静态配置推导。 */
export type RuntimeOverrides = {
    granularity?: Granularity;
    workspaceScope?: WorkspaceScope;
};
/** workspaceRegistry 记录的 client 投影。 */
export type WorkspaceLite = {
    id: string;
    title: string;
    path: string;
};
/** state 文件路径：$DSH_HOME/dsh-weixin-clawbot.state.json（回退 ~/.dsh）。 */
export declare function resolveStatePath(): string;
/** 一次性迁移旧包名（dsh-wechat）的 state 文件；新文件已存在则不动。 */
export declare function migrateLegacyStateFile(newFile: string): void;
/** 从静态配置推导颗粒度（存量用户行为保持不变）。 */
export declare function granularityFromConfig(config: Pick<WechatConfig, 'replyOn' | 'noticeTools'>): Granularity;
/** 颗粒度 → replyOn。 */
export declare function replyOnOf(granularity: Granularity): 'step' | 'turn';
/** 颗粒度 → noticeTools。 */
export declare function noticeToolsOf(granularity: Granularity): boolean;
/** 读取运行时覆盖；文件缺失/损坏/多余字段一律安全回退。 */
export declare function loadState(file: string): RuntimeOverrides;
/** 原子写入运行时覆盖（临时文件 + rename），自动创建父目录。 */
export declare function saveState(file: string, overrides: RuntimeOverrides): void;
/**
 * 校验 POST /wechat/settings 的 body。
 * workspaceScope 指定具体工作区时，其 id 必须出现在当前工作区列表里。
 */
export declare function validateSettingsInput(body: unknown, workspaces: readonly WorkspaceLite[]): {
    ok: true;
    patch: RuntimeOverrides;
} | {
    ok: false;
    message: string;
};
