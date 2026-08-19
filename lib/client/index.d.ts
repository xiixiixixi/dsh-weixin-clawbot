/**
 * dsh-weixin-clawbot 的浏览器半部分：侧边栏「微信机器人」入口 + 配对管理弹窗。
 *
 * 弹窗对齐 zcode Bot Channel 微信管理页：关联机器人（扫码/解绑）、
 * 回复颗粒度、工作区访问范围。轮询 GET /wechat/qrcode，
 * 设置写入 POST /wechat/settings，解绑 POST /wechat/logout。
 *
 * @module dsh-weixin-clawbot/client
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
/** Services required by the client plugin. */
export declare const inject: string[];
/** Registers the WeChat entry into the sidebar footer actions slot. */
export declare function apply(ctx: ClientContext): void;
