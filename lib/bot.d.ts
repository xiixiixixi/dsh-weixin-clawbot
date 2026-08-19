/**
 * Wechaty 接入层：实例创建、二维码登录、媒体收发。
 *
 * @module dsh-weixin-clawbot/bot
 */
import { FileBox } from '@juzi/file-box';
import type { Contact, Friendship, Message, Wechaty } from '@juzi/wechaty';
export type WechatBotOptions = {
    name: string;
    puppet: string;
    puppetOptions: Record<string, unknown>;
    log: (message: string) => void;
    onScan?: (qrcode: string, status: number) => void;
    onLogin?: (user: Contact) => void;
    onLogout?: (user: Contact) => void;
    onMessage?: (message: Message) => Promise<void> | void;
    onFriendship?: (friendship: Friendship) => Promise<void> | void;
    onError?: (error: Error) => void;
};
/** 把 puppet 名解析成 WechatyBuilder.build 可用的 puppet 参数。 */
export declare function resolvePuppetConfig(puppet: string, puppetOptions: Record<string, unknown>): Promise<{
    puppet: unknown;
    puppetOptions: Record<string, unknown>;
}>;
/** 创建 wechaty 实例并绑定标准事件。 */
export declare function createWechatBot(opts: WechatBotOptions): Wechaty;
/** 微信消息类型 → 媒体种类（file-box 可下载的类型）。 */
export declare function mediaKindOf(type: number): 'image' | 'voice' | 'video' | 'file' | undefined;
/** 下载入站媒体到 mediaDir，返回落盘路径。 */
export declare function saveInboundMedia(params: {
    message: Message;
    mediaDir: string;
    maxBytes: number;
    log: (message: string) => void;
}): Promise<{
    kind: 'image' | 'voice' | 'video' | 'file';
    path: string;
} | undefined>;
/** 出站媒体：本地路径 / URL / buffer → FileBox。 */
export declare function prepareOutboundMedia(params: {
    mediaUrl?: string;
    fileName?: string;
}): Promise<FileBox | undefined>;
/** 发送文本（按需分块）与可选媒体到联系人或群。 */
export declare function sendToRecipient(bot: Wechaty, targetId: string, opts: {
    text?: string;
    chunks?: string[];
    mediaUrl?: string;
    log: (message: string) => void;
}): Promise<void>;
