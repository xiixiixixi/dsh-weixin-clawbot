/**
 * 微信官方 iLink 机器人通道（clawbot）。
 *
 * 对齐腾讯官方 OpenClaw 微信插件（@tencent-weixin/openclaw-weixin）的
 * 后端协议：扫码登录（含手机配对码校验）→ getupdates 长轮询收消息 →
 * sendmessage 发回复。凭据持久化到 $DSH_HOME/dsh-weixin-clawbot-ilink.json。
 *
 * 协议要点（源码逆向整理）：
 * - 固定网关 https://ilinkai.weixin.qq.com；扫码确认后响应里的 baseurl
 *   是该账号的消息网关（IDC 就近）。
 * - 请求头：iLink-App-Id: bot、iLink-App-ClientVersion（0xMMmmpp）、
 *   AuthorizationType: ilink_bot_token、Authorization: Bearer <token>、
 *   X-WECHAT-UIN（随机 uint32 的 base64）。
 * - getupdates 携带上一轮返回的 get_updates_buf 游标；errcode -14 表示
 *   会话失效需重新登录。
 *
 * @module dsh-weixin-clawbot/ilink
 */
/** iLink 固定登录网关。 */
export declare const ILINK_LOGIN_BASE_URL = "https://ilinkai.weixin.qq.com";
/** 凭据落盘结构。 */
export type IlinkCredentials = {
    token: string;
    /** 扫码确认返回的 ilink_bot_id（本机器人的身份）。 */
    botId: string;
    /** 扫码人（bot 主人）的 ilink_user_id。 */
    userId: string;
    /** 消息网关（baseurl）。 */
    baseUrl: string;
};
/** 一轮登录轮询的结果。 */
export type IlinkLoginTick = {
    kind: 'wait';
} | {
    kind: 'scaned';
} | {
    kind: 'expired';
} | {
    kind: 'need-verifycode';
    wrongCode?: boolean;
} | {
    kind: 'verify-code-blocked';
} | {
    kind: 'binded';
} | {
    kind: 'confirmed';
    credentials: IlinkCredentials;
};
/** 入站消息（已归一化：群/私聊、文本、上下文 token）。 */
export type IlinkInboundMessage = {
    /** 私聊 = 对端用户 id；群聊 = 群内发送者 id。 */
    fromUserId: string;
    /** 群聊时的群 id。 */
    groupId?: string;
    /** 文本（含语音转文字）；纯媒体消息为空串。 */
    text: string;
    /** 媒体摘要（如「[图片]」），拼在 text 后交给 agent。 */
    mediaNote?: string;
    /** 回复时应携带的上下文 token。 */
    contextToken?: string;
};
type FetchLike = typeof fetch;
export type IlinkChannelOptions = {
    /** 凭据文件路径；默认 $DSH_HOME/dsh-weixin-clawbot-ilink.json。 */
    stateFile?: string;
    log?: (message: string) => void;
    /** 自定义 fetch（测试注入）。 */
    fetchImpl?: FetchLike;
    /** 自声明的 bot_agent（观测用，默认 DSH）。 */
    botAgent?: string;
};
/** iLink 通道客户端：登录态机 + 消息长轮询 + 出站发送。 */
export declare class IlinkChannel {
    private readonly log;
    private readonly fetchImpl;
    private readonly stateFile;
    /** 当前二维码（qrcode=轮询凭据，qrUrl=二维码内容 URL）。 */
    private qrCode;
    private qrUrl;
    /** 待提交的手机配对码；下次轮询携带。 */
    private pendingVerifyCode;
    /** 上次轮询是否已处于 need-verifycode（用于区分「输错重输」）。 */
    private lastNeededVerifyCode;
    /** getupdates 游标。 */
    private updatesBuf;
    private running;
    private credentials;
    constructor(opts?: IlinkChannelOptions);
    /** 已保存的凭据（自动登录）。 */
    savedCredentials(): IlinkCredentials | undefined;
    /** 发起新的扫码登录（丢弃旧二维码）。 */
    startLogin(): Promise<string>;
    /** 当前二维码内容 URL（供渲染 PNG）；未发起登录时为 undefined。 */
    currentQrUrl(): string | undefined;
    /** 用户在弹窗里输入手机配对码。 */
    submitVerifyCode(code: string): void;
    /** 登录轮询推进一拍（长轮询 ~35s）；无进行中的二维码时返回 wait。 */
    pollLoginOnce(): Promise<IlinkLoginTick>;
    /** 解绑：清凭据并停止消息循环。 */
    logout(): Promise<void>;
    /** 消息循环：getupdates 长轮询直到 stop() 或解绑。 */
    runMessageLoop(onMessage: (message: IlinkInboundMessage) => void, onError?: (error: unknown) => void): Promise<void>;
    /** 停止消息循环（不断开凭据）；best-effort 通知服务端。 */
    stop(): void;
    /** 发送文本消息（chunk 由调用方负责）。 */
    sendText(toUserId: string, text: string, contextToken?: string): Promise<void>;
    private botAgentHeaderValue;
    private agentName;
    /** 设置 bot_agent 自声明（UA 风格 Name/Version）。 */
    setBotAgent(name: string | undefined): void;
    private buildHeaders;
    private request;
    private postJson;
    private getJson;
}
/** 读取凭据；缺失/损坏返回 undefined。 */
export declare function loadIlinkCredentials(file: string, log: (message: string) => void): IlinkCredentials | undefined;
/** 原子写入凭据。 */
export declare function saveIlinkCredentials(file: string, credentials: IlinkCredentials, log: (message: string) => void): void;
export {};
