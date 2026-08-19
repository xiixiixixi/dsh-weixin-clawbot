/**
 * 文本与事件格式化纯函数：assistant 消息文本提取、微信分块、控制命令解析。
 *
 * @module dsh-weixin-clawbot/format
 */
import type { AssistantMessage } from '@deepseek-ai/dsh-llm';
import type { TurnEndReason } from '@deepseek-ai/dsh-session';
/** 从 assistant 消息中提取可见文本。 */
export declare function extractAssistantText(message: AssistantMessage): string;
/**
 * 按段落把长文本切成适合微信发送的块（不超过 limit，尽量在段落边界断开）。
 * @param text - 待发送文本。
 * @param limit - 单条上限（字符数）。
 */
export declare function chunkForWechat(text: string, limit: number): string[];
export type ControlCommand = {
    kind: 'new';
} | {
    kind: 'stop';
} | {
    kind: 'status';
} | {
    kind: 'help';
} | {
    kind: 'ws';
    arg?: string;
};
/** 解析微信控制命令；非命令返回 null。 */
export declare function parseControlCommand(text: string): ControlCommand | null;
export declare const HELP_TEXT: string;
/** turn 结束原因 → 给用户的错误摘要。 */
export declare function turnEndSummary(reason: TurnEndReason): string | undefined;
/** 入站媒体占位文本（模型可见）。 */
export declare function mediaPlaceholder(kind: 'image' | 'voice' | 'video' | 'file', path: string): string;
