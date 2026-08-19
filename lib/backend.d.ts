/**
 * 微信后端：桥接 wechaty 消息与 DSH agent 会话。
 *
 * - 入站：微信消息 → 策略判断 → 每个微信主体一个 Agent → `followup`
 * - 出站：订阅 `session/event`，把本插件会话的 assistant 文本发回微信
 * - 网页：暴露 `/wechat/qrcode` 状态，供 Web GUI 的扫码窗口轮询登录二维码
 *
 * @module dsh-weixin-clawbot/backend
 */
import type { Context } from '@deepseek-ai/cordis';
import { type Agent } from '@deepseek-ai/dsh-agent';
import { SessionId } from '@deepseek-ai/dsh-session';
import { type WechatConfig } from './config.js';
import { type Granularity, type RuntimeOverrides, type WorkspaceLite, type WorkspaceScope } from './state.js';
/** 微信登录/扫码状态（供 Web GUI 扫码窗口展示）。verifyCode 仅 iLink 配对码阶段出现。 */
export type WechatQrState = {
    kind: 'none';
} | {
    kind: 'scan';
    qrcode: string;
    status: number;
    png: string;
    verifyCode?: 'needed' | 'wrong' | 'blocked';
} | {
    kind: 'logged-in';
    userId: string;
    userName: string;
};
/** `/wechat/qrcode` 路由的响应载荷。 */
export type WechatQrPayload = {
    ok: boolean;
    state: WechatQrState;
    /** 扫码备用链接（终端/手机浏览器打开）。 */
    url?: string;
    /** 已登录用户信息。 */
    user?: {
        id: string;
        name: string;
    };
    /** 当前 puppet 后端包名。 */
    puppet: string;
    /** 生效的运行时设置。 */
    settings: {
        granularity: Granularity;
        workspaceScope: WorkspaceScope;
    };
    /** workspaceRegistry 投影（无注册表时为空）。 */
    workspaces: WorkspaceLite[];
};
/** workspaceRegistry 的最小结构类型：避免新增包依赖。 */
export type WorkspaceRegistryLike = {
    list(): ReadonlyArray<{
        id: unknown;
        title: string;
        path: string;
        attachSession?: (sessionId: unknown) => Promise<void>;
    }>;
};
/** agentPresets 的最小结构类型（resolve + mount 装配工具组合）。 */
export type AgentPresetsLike = {
    resolve(id?: string): Promise<{
        id: string;
    }>;
    mount(agentCtx: Context, id?: string): Promise<unknown>;
};
declare module '@deepseek-ai/cordis' {
    interface Context {
        workspaceRegistry?: WorkspaceRegistryLike;
        agentPresets?: AgentPresetsLike;
    }
}
export declare class WechatBackend {
    private readonly ctx;
    private readonly config;
    private bot;
    private readonly owned;
    private currentUser;
    private started;
    private readonly disposers;
    private readonly log;
    private qrState;
    private workspaceRegistry;
    /** agentPresets 服务（index.ts 懒注入）：给微信 agent 装配工具组合。 */
    private agentPresets;
    private overrides;
    private readonly stateFile;
    /** 主体 → /ws 切换的当前工作区 id（内存态，重启回默认）。 */
    private readonly subjectWorkspace;
    /** 主体 → 当前会话 id（/new 后换成新生代 id）。 */
    private readonly subjectSession;
    /** /new 标记：下条消息铸造全新会话 id。 */
    private readonly freshNext;
    /** 进程代次后缀：重启后换新 id，避免与磁盘持久化日志撞车。 */
    private readonly processGen;
    constructor(ctx: Context, config: WechatConfig, stateFile?: string);
    /** 当前二维码/登录状态（HTTP 路由读取）。 */
    qrPayload(): WechatQrPayload;
    /** workspaceRegistry 注入/撤销（index.ts 懒注入调用）。 */
    setWorkspaceRegistry(registry: WorkspaceRegistryLike | undefined): void;
    /** agentPresets 注入/撤销（index.ts 懒注入调用）。 */
    setAgentPresets(presets: AgentPresetsLike | undefined): void;
    /** 工作区列表投影（无注册表时空数组）。 */
    workspacesProjection(): WorkspaceLite[];
    /** 当前生效设置：state 覆盖优先，缺省从静态配置推导。 */
    effectiveSettings(): {
        granularity: Granularity;
        workspaceScope: WorkspaceScope;
    };
    /** 允许访问的工作区 id 列表（'all' = 全部；多选时与现存工作区求交集）。 */
    allowedWorkspaceIds(): string[];
    /** 主体的当前工作区 id：/ws 切换的内存覆盖（须仍在允许范围内），否则默认。 */
    private currentWorkspaceId;
    /** 会话路由：当前工作区 → 会话 id（每工作区独立历史）+ agent cwd。
     *
     * 会话 id 带进程代次后缀（`~p…`）：rc.7 的 agents.create 不支持恢复
     * 已持久化的同 id 会话（重启后同 id 重建会被判 id collision / already
     * exists），因此每个进程用独立代次——进程内连续、重启开新篇（旧对话
     * 仍持久化在磁盘，可在 Web UI 查看）。/new 再叠加时间戳铸造全新 id。
     */
    private routeFor;
    /** 工作区 id → agent cwd；未指定/已消失时回退静态配置。 */
    private cwdFor;
    /** 合并覆盖 → 持久化 → 返回生效值（弹窗 POST /wechat/settings 调用）。 */
    updateSettings(patch: RuntimeOverrides): {
        granularity: Granularity;
        workspaceScope: WorkspaceScope;
    };
    /** 解绑：登出微信、复位扫码状态（幂等）。 */
    logout(): Promise<void>;
    /** 测试可见的 agent 创建入口。 */
    getOrCreateAgentForTest(sessionId: SessionId, cwd: string): Promise<Agent>;
    /** 异步渲染二维码 PNG（供 Web 扫码窗口内嵌显示）；保留同码上的 verifyCode 标记。 */
    private renderQrPng;
    /** 启动：订阅会话事件、解析 puppet、启动微信通道（wechaty 或 iLink）。 */
    start(): Promise<void>;
    private ilinkChannel;
    /** ilink 出站回复需携带的每对端最新 context_token。 */
    private readonly contextTokens;
    /** 二维码自动刷新次数上限。 */
    private static readonly ILINK_QR_REFRESH_LIMIT;
    private startIlink;
    /** iLink 扫码登录循环：出二维码 → 长轮询状态 → 确认后进入消息循环。 */
    private runIlinkLoginLoop;
    /** iLink 消息循环包装：结束后回到待扫码态（如会话失效 -14）。 */
    private runIlinkLoop;
    /** iLink 入站消息：策略检查后走与 wechaty 相同的分发管线。 */
    private handleIlinkMessage;
    /** 用户在弹窗提交手机配对码（仅 iLink）。 */
    submitVerifyCode(code: string): void;
    /** 关闭：停止微信通道、释放全部会话与事件订阅。 */
    dispose(): Promise<void>;
    /** 入站微信消息 → agent。 */
    private handleMessage;
    /** 控制命令与 agent followup 的共用分发管线。 */
    private dispatchToAgent;
    /** 好友请求处理：按配置自动通过。 */
    private handleFriendship;
    /** 会话事件 → 微信回复。 */
    private onSessionEvent;
    /** 控制命令。 */
    private handleCommand;
    /** /ws 命令：无参列出可切换的工作区；有序号/名称则切换当前主体的工作区。 */
    private wsCommandReply;
    /** 获取（或创建）一个微信主体专属的 agent（cwd 由路由决定）。
     *
     * rc.7 的 agents.create 不支持恢复已持久化会话；会话 id 由 routeFor
     * 保证每进程独立代次，这里无需（也不能）传 seed 接管。
     */
    private getOrCreateAgent;
    /** 回复微信：按配置分块发送文本。 */
    private reply;
}
