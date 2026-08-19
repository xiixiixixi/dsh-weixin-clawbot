/**
 * DeepSeek Harness 微信远程控制插件。
 *
 * 在 cordis.yml 中挂载即可用微信远程对话/控制运行中的 DSH agent：
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
 * @module dsh-weixin-clawbot
 */
import { WechatBackend } from './backend.js';
import { validateSettingsInput } from './state.js';
export { Config, resolveMediaDir } from './config.js';
export { decideDm, decideGroup, normalizeWechatId, resolveGroupMatch, resolveSenderMatch, } from './policy.js';
export { HELP_TEXT, chunkForWechat, extractAssistantText, mediaPlaceholder, parseControlCommand, turnEndSummary, } from './format.js';
export { isWechatSession, sendTargetFromSessionId, sessionIdFor, subjectFromSessionId, WECHAT_SESSION_PREFIX, } from './sessions.js';
export { WechatBackend } from './backend.js';
export { granularityFromConfig, loadState, noticeToolsOf, replyOnOf, resolveStatePath, saveState, validateSettingsInput, } from './state.js';
export const name = 'dsh-weixin-clawbot';
export const inject = ['agents', 'sessions', 'agentDefaultModel'];
/** Web GUI 扫码窗口轮询的二维码/登录状态端点。 */
export const QRCODE_ROUTE_PATH = '/wechat/qrcode';
/** 读取并解析 JSON body（限制 64KB，异常一律返回 undefined）。 */
function readJsonBody(req) {
    return new Promise((resolve) => {
        const chunks = [];
        let size = 0;
        req.on('data', (chunk) => {
            size += chunk.length;
            if (size > 64 * 1024) {
                req.destroy();
                resolve(undefined);
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            try {
                resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined);
            }
            catch {
                resolve(undefined);
            }
        });
        req.on('error', () => resolve(undefined));
    });
}
function jsonReply(res, status, body) {
    res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
    });
    res.end(JSON.stringify(body));
}
export function apply(ctx, config) {
    const backend = new WechatBackend(ctx, config);
    void backend.start().catch((error) => {
        ctx.logger.error(`dsh-weixin-clawbot: 启动失败: ${String(error)}`);
    });
    // 提供二维码给浏览器：web profile 里有 webServer 服务时注册 HTTP 路由；
    // 没有（headless 等 profile）则等待服务出现，永不注册也不影响微信功能。
    ctx.inject(['webServer'], (webCtx) => {
        const route = {
            kind: 'exact',
            path: QRCODE_ROUTE_PATH,
            handler: (_req, res) => {
                res.writeHead(200, {
                    'content-type': 'application/json; charset=utf-8',
                    'cache-control': 'no-store',
                });
                res.end(JSON.stringify(backend.qrPayload()));
            },
        };
        webCtx.effect(() => webCtx.webServer.register(route), 'dsh-weixin-clawbot: /wechat/qrcode route');
        webCtx.effect(() => webCtx.webServer.register({
            kind: 'exact',
            path: '/wechat/settings',
            handler: async (req, res) => {
                const body = await readJsonBody(req);
                const verdict = validateSettingsInput(body, backend.workspacesProjection());
                if (!verdict.ok) {
                    jsonReply(res, 400, { ok: false, message: verdict.message });
                    return;
                }
                jsonReply(res, 200, { ok: true, settings: backend.updateSettings(verdict.patch) });
            },
        }), 'dsh-weixin-clawbot: /wechat/settings route');
        webCtx.effect(() => webCtx.webServer.register({
            kind: 'exact',
            path: '/wechat/verify',
            handler: async (req, res) => {
                const body = (await readJsonBody(req));
                if (typeof body?.code !== 'string' || body.code.trim() === '') {
                    jsonReply(res, 400, { ok: false, message: 'code 必须是非空字符串' });
                    return;
                }
                backend.submitVerifyCode(body.code.trim());
                jsonReply(res, 200, { ok: true });
            },
        }), 'dsh-weixin-clawbot: /wechat/verify route');
        webCtx.effect(() => webCtx.webServer.register({
            kind: 'exact',
            path: '/wechat/logout',
            handler: async (_req, res) => {
                await backend.logout();
                jsonReply(res, 200, { ok: true });
            },
        }), 'dsh-weixin-clawbot: /wechat/logout route');
    });
    // workspaceRegistry 可选注入：注册表上线时把工作区列表接进后端；
    // headless 等没有注册表的 profile 不影响微信功能（下拉退化为「所有工作区」）。
    ctx.inject(['workspaceRegistry'], (regCtx) => {
        backend.setWorkspaceRegistry(regCtx.workspaceRegistry);
        regCtx.effect(() => () => backend.setWorkspaceRegistry(undefined), 'dsh-weixin-clawbot: workspaceRegistry unbind');
    });
    // agentPresets 可选注入：微信 agent 的 setup 里 mount 默认工具组合
    // （标准模式），否则 agent 无工具、模型把工具调用写成纯文本。
    ctx.inject(['agentPresets'], (presetCtx) => {
        backend.setAgentPresets(presetCtx.agentPresets);
        presetCtx.effect(() => () => backend.setAgentPresets(undefined), 'dsh-weixin-clawbot: agentPresets unbind');
    });
    ctx.effect(() => () => {
        void backend.dispose();
    });
}
