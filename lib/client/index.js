import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * dsh-weixin-clawbot 的浏览器半部分：侧边栏「微信机器人」入口 + 配对管理弹窗。
 *
 * 弹窗对齐 zcode Bot Channel 微信管理页：关联机器人（扫码/解绑）、
 * 回复颗粒度、工作区访问范围。轮询 GET /wechat/qrcode，
 * 设置写入 POST /wechat/settings，解绑 POST /wechat/logout。
 *
 * @module dsh-weixin-clawbot/client
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { IconCheckOutline14, IconChevronDownOutline14, IconCloseOutline16, IconCopyOutline16, IconRightUpOutline14, Menu, Modal, StateDot, Tooltip, writeClipboard, } from '@deepseek-ai/dsh-client-ui-primitives';
import cssText from './wechat.css';
// 模块加载器在工厂执行后立即认领此时存在的无主 <style> 标签，
// 因此注入必须发生在模块顶层（工厂体内）而不是 apply() 里。
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.setAttribute('data-plugin-css', 'dsh-weixin-clawbot');
    document.head.append(style);
    style.textContent = cssText;
}
/** Services required by the client plugin. */
export const inject = ['slots'];
const GRANULARITY_ITEMS = [
    { id: 'detailed', label: '完整回复' },
    { id: 'standard', label: '标准回复' },
    { id: 'summary', label: '摘要回复' },
];
/** wechaty ScanStatus（0/1/2/3/4/5）→ 用户可读文案；不暴露状态码。 */
function scanHint(status) {
    if (status === 3)
        return '已扫码，请在手机上确认';
    if (status === 4)
        return '已确认，正在登录…';
    if (status === 5 || status === 1)
        return '二维码已过期，正在获取新码…';
    return '等待手机扫码';
}
/** 整体状态：StateDot 语义 + 一行文案（状态行与入口 tooltip 共用）。 */
function statusOf(payload, error) {
    if (error !== null)
        return { dot: 'error', text: '连接中断，正在重试…' };
    if (payload === null)
        return { dot: 'ongoing', text: '微信后端启动中…' };
    switch (payload.state.kind) {
        case 'none':
            return { dot: 'ongoing', text: '微信后端启动中…' };
        case 'scan':
            return { dot: 'ongoing', text: scanHint(payload.state.status) };
        case 'logged-in':
            return {
                dot: 'done',
                text: `已连通：${payload.user?.name ?? payload.state.userName}`,
            };
    }
}
/** 轮询 /wechat/qrcode；open 时 2s，否则 10s。 */
function useQrPoll(open) {
    const [payload, setPayload] = useState(null);
    const [error, setError] = useState(null);
    const [tick, setTick] = useState(0);
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        const poll = async () => {
            try {
                const response = await fetch('/wechat/qrcode', { cache: 'no-store' });
                if (!response.ok)
                    throw new Error(`HTTP ${response.status}`);
                const data = (await response.json());
                if (alive.current) {
                    setPayload(data);
                    setError(null);
                }
            }
            catch (err) {
                if (alive.current)
                    setError(String(err));
            }
        };
        void poll();
        const timer = setInterval(() => void poll(), open ? 2000 : 10000);
        return () => {
            alive.current = false;
            clearInterval(timer);
        };
    }, [open, tick]);
    const refresh = useCallback(() => setTick((value) => value + 1), []);
    return { payload, error, refresh };
}
async function postJson(path, body) {
    try {
        const response = await fetch(path, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        return response.ok;
    }
    catch {
        return false;
    }
}
/** 设置行：左侧标题/描述，右侧控件。 */
function SettingRow(props) {
    return (_jsxs("div", { className: "dsh-weixin-clawbot-row", children: [_jsxs("div", { className: "dsh-weixin-clawbot-row-text", children: [_jsx("div", { className: "dsh-weixin-clawbot-row-label", children: props.label }), _jsx("div", { className: "dsh-weixin-clawbot-row-desc", children: props.desc })] }), props.children] }));
}
/** 下拉选择（dsh Menu primitive，portal 防弹窗裁剪）。 */
function DropdownSelect(props) {
    const [open, setOpen] = useState(false);
    const selected = props.options.find((option) => option.id === props.value);
    return (_jsx(Menu, { open: open, onClose: () => setOpen(false), portal: true, align: "end", items: props.options.map((option) => ({
            id: option.id,
            label: option.desc !== undefined ? `${option.label}（${option.desc}）` : option.label,
        })), selectedId: props.value, onSelect: (id) => {
            setOpen(false);
            if (id !== props.value)
                props.onSelect(id);
        }, anchor: _jsxs("button", { type: "button", className: "dsh-weixin-clawbot-select", disabled: props.disabled, onClick: () => setOpen((value) => !value), children: [_jsx("span", { className: "dsh-weixin-clawbot-select-label", children: selected?.label ?? props.label }), _jsx(IconChevronDownOutline14, { size: 14 })] }) }));
}
/** 工作区访问范围多选列表（zcode 同款 checkbox 行）。 */
function WorkspaceScopeList(props) {
    const scope = props.scope;
    const isAll = scope === 'all';
    const selected = isAll ? [] : scope.workspaceIds;
    const row = (props2) => (_jsxs("button", { type: "button", className: "dsh-weixin-clawbot-check-row", disabled: props.disabled, role: "menuitemcheckbox", "aria-checked": props2.checked, onClick: props2.onToggle, children: [_jsx("span", { className: "dsh-weixin-clawbot-check-box", "data-checked": props2.checked, children: props2.checked && _jsx(IconCheckOutline14, { size: 12 }) }), _jsxs("span", { className: "dsh-weixin-clawbot-check-text", children: [_jsx("span", { className: "dsh-weixin-clawbot-check-title", children: props2.title }), props2.path !== undefined && _jsx("span", { className: "dsh-weixin-clawbot-check-path", children: props2.path })] })] }, props2.key));
    return (_jsxs("div", { className: "dsh-weixin-clawbot-check-list", role: "group", "aria-label": "\u5DE5\u4F5C\u533A\u8BBF\u95EE\u8303\u56F4", children: [row({
                key: 'all',
                checked: isAll,
                title: '所有工作区',
                onToggle: () => {
                    if (!isAll)
                        props.onAll();
                },
            }), props.workspaces.map((workspace) => row({
                key: workspace.id,
                checked: selected.includes(workspace.id),
                title: workspace.title,
                path: workspace.path,
                onToggle: () => props.onToggle(workspace.id),
            })), props.workspaces.length === 0 && (_jsx("div", { className: "dsh-weixin-clawbot-check-empty", children: "DSH \u91CC\u8FD8\u6CA1\u6709\u5DF2\u6CE8\u518C\u7684\u5DE5\u4F5C\u533A\u3002" }))] }));
}
/** iLink 配对码输入行：手机微信显示数字，输入后 POST /wechat/verify。 */
function VerifyCodeRow(props) {
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    if (props.state === 'blocked') {
        return (_jsxs("div", { className: "dsh-weixin-clawbot-note", children: [_jsx("span", { "aria-hidden": "true", children: "\u26D4" }), _jsx("span", { children: "\u914D\u5BF9\u7801\u591A\u6B21\u8F93\u5165\u9519\u8BEF\uFF0C\u8BF7\u7A0D\u540E\u7B49\u4E8C\u7EF4\u7801\u81EA\u52A8\u5237\u65B0\u540E\u91CD\u8BD5\u3002" })] }));
    }
    return (_jsxs("div", { className: "dsh-weixin-clawbot-verify", children: [_jsx("span", { className: "dsh-weixin-clawbot-verify-label", children: props.state === 'wrong' ? '❌ 配对码不正确，请重新输入：' : '输入手机微信上显示的数字，完成配对：' }), _jsx("input", { className: "dsh-weixin-clawbot-verify-input", value: code, inputMode: "numeric", autoFocus: true, placeholder: "\u914D\u5BF9\u7801", onChange: (event) => setCode(event.target.value), onKeyDown: (event) => {
                    if (event.key === 'Enter' && code.trim() !== '' && !busy) {
                        setBusy(true);
                        void postJson('/wechat/verify', { code: code.trim() }).finally(() => setBusy(false));
                    }
                } }), _jsx("button", { type: "button", className: "dsh-weixin-clawbot-select", disabled: code.trim() === '' || busy, onClick: () => {
                    setBusy(true);
                    void postJson('/wechat/verify', { code: code.trim() }).finally(() => setBusy(false));
                }, children: "\u63D0\u4EA4" })] }));
}
/** 配对管理弹窗主体（headless Modal：自绘 header/关闭钮，chrome 走 Modal）。 */
function WechatDialog(props) {
    const [copied, setCopied] = useState(false);
    // 乐观工作区范围：POST 成功后立即生效，等轮询追上（值一致）后清除，
    // 避免快速连点时基于旧列表计算下一次勾选。
    const [optimisticScope, setOptimisticScope] = useState(null);
    const status = statusOf(props.payload, props.error);
    const state = props.payload?.state;
    const settings = props.payload?.settings;
    const workspaces = props.payload?.workspaces ?? [];
    const effectiveScope = optimisticScope ?? settings?.workspaceScope ?? 'all';
    useEffect(() => {
        if (optimisticScope !== null
            && JSON.stringify(settings?.workspaceScope) === JSON.stringify(optimisticScope)) {
            setOptimisticScope(null);
        }
    }, [settings, optimisticScope]);
    // 权威 scope 走 ref：同一渲染批次里的连点也能看到彼此的结果。
    const scopeRef = useRef(effectiveScope);
    scopeRef.current = effectiveScope;
    const applyScope = (next) => {
        scopeRef.current = next;
        setOptimisticScope(next);
        void postJson('/wechat/settings', { workspaceScope: next }).then((ok) => {
            if (ok)
                props.refresh();
            else
                setOptimisticScope(null);
        });
    };
    const copyLink = async () => {
        if (props.payload?.url === undefined)
            return;
        if (await writeClipboard(props.payload.url)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };
    const updateSettings = async (patch) => {
        if (await postJson('/wechat/settings', patch))
            props.refresh();
    };
    return (_jsx(Modal, { open: props.open, onClose: props.onClose, title: "\u5FAE\u4FE1\u673A\u5668\u4EBA", closeLabel: "\u5173\u95ED", className: "dsh-weixin-clawbot-dialog", headless: true, children: _jsxs("div", { className: "dsh-weixin-clawbot-frame", children: [_jsxs("div", { className: "dsh-weixin-clawbot-header", children: [_jsx("span", { className: "dsh-weixin-clawbot-logo", "aria-hidden": "true", children: _jsx(WechatGlyph, {}) }), _jsxs("div", { className: "dsh-weixin-clawbot-header-main", children: [_jsx("h2", { className: "dsh-weixin-clawbot-title", children: "\u5FAE\u4FE1\u673A\u5668\u4EBA" }), _jsx("p", { className: "dsh-weixin-clawbot-subtitle", children: "\u5728\u5FAE\u4FE1\u91CC\u8FDC\u7A0B\u64CD\u63A7 DSH agent\u3002" })] }), _jsx("button", { type: "button", className: "dsh-weixin-clawbot-close", "aria-label": "\u5173\u95ED", onClick: props.onClose, children: _jsx(IconCloseOutline16, { size: 14 }) })] }), _jsxs("div", { className: "dsh-weixin-clawbot-statusline", children: [_jsx(StateDot, { state: status.dot }), _jsx("span", { children: status.text })] }), _jsxs("div", { className: "dsh-weixin-clawbot-section", children: [_jsx("div", { className: "dsh-weixin-clawbot-section-title", children: "\u5173\u8054\u673A\u5668\u4EBA" }), _jsx("div", { className: "dsh-weixin-clawbot-section-desc", children: "\u626B\u7801\u540E\u81EA\u52A8\u4FDD\u5B58\u51ED\u636E\u3002" }), state?.kind === 'scan' && (_jsxs(_Fragment, { children: [_jsx("div", { className: "dsh-weixin-clawbot-qr-card", children: state.png ? (_jsx("img", { className: "dsh-weixin-clawbot-qr-img", src: state.png, alt: "\u5FAE\u4FE1\u767B\u5F55\u4E8C\u7EF4\u7801" })) : (_jsx("div", { className: "dsh-weixin-clawbot-qr-img", style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#888',
                                            fontSize: 13,
                                        }, children: "\u4E8C\u7EF4\u7801\u751F\u6210\u4E2D\u2026" })) }), _jsx("div", { className: "dsh-weixin-clawbot-qr-hint", children: scanHint(state.status) }), state.verifyCode !== undefined && _jsx(VerifyCodeRow, { state: state.verifyCode }), props.payload?.url !== undefined && state.verifyCode === undefined && (_jsxs("div", { className: "dsh-weixin-clawbot-linkrow", children: [_jsx("span", { children: "\u65E0\u6CD5\u626B\u7801\uFF1F\u5728\u624B\u673A\u6D4F\u89C8\u5668\u6253\u5F00\u94FE\u63A5" }), _jsxs("button", { type: "button", className: "dsh-weixin-clawbot-linkbtn", onClick: () => void copyLink(), children: [copied ? _jsx(IconCheckOutline14, { size: 14 }) : _jsx(IconCopyOutline16, { size: 14 }), copied ? '已复制' : '复制'] }), _jsx("a", { className: "dsh-weixin-clawbot-linkbtn", href: props.payload.url, target: "_blank", rel: "noopener noreferrer", children: _jsx(IconRightUpOutline14, { size: 14 }) })] }))] })), state?.kind === 'logged-in' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "dsh-weixin-clawbot-connected", children: [_jsx(StateDot, { state: "done" }), _jsxs("div", { className: "dsh-weixin-clawbot-connected-main", children: [_jsx("span", { className: "dsh-weixin-clawbot-connected-name", children: props.payload?.user?.name ?? state.userName }), _jsx("span", { className: "dsh-weixin-clawbot-connected-id", children: state.userId })] }), _jsx("button", { type: "button", className: "dsh-weixin-clawbot-select", onClick: () => {
                                                void postJson('/wechat/logout').then(props.refresh);
                                            }, children: "\u89E3\u7ED1" })] }), _jsxs("div", { className: "dsh-weixin-clawbot-note", children: [_jsx("span", { "aria-hidden": "true", children: "\u24D8" }), _jsx("span", { children: "\u8BF7\u5728\u5FAE\u4FE1\u91CC\u5411\u673A\u5668\u4EBA\u53D1\u9001\u4EFB\u610F\u6D88\u606F\uFF1B\u9996\u6B21\u6D88\u606F\u4F1A\u6536\u5230\u6B22\u8FCE\u548C\u5E2E\u52A9\u3002" })] })] })), (state === undefined || state.kind === 'none') && (_jsx("div", { className: "dsh-weixin-clawbot-qr-hint", children: "\u7B49\u5F85\u5FAE\u4FE1\u540E\u7AEF\u5C31\u7EEA\u540E\u663E\u793A\u4E8C\u7EF4\u7801\u2026" }))] }), _jsxs("div", { className: "dsh-weixin-clawbot-section", children: [_jsx("div", { className: "dsh-weixin-clawbot-section-title", children: "\u673A\u5668\u4EBA\u56DE\u590D\u9897\u7C92\u5EA6" }), _jsx(SettingRow, { label: "\u6D88\u606F\u8BE6\u7EC6\u7A0B\u5EA6", desc: "\u63A7\u5236\u673A\u5668\u4EBA\u56DE\u590D\u7684\u8BE6\u7EC6\u7A0B\u5EA6\u3002", children: _jsx(DropdownSelect, { label: "\u6807\u51C6\u56DE\u590D", options: GRANULARITY_ITEMS, value: settings?.granularity ?? 'standard', disabled: settings === undefined, onSelect: (id) => {
                                    void updateSettings({ granularity: id });
                                } }) })] }), _jsxs("div", { className: "dsh-weixin-clawbot-section", children: [_jsx("div", { className: "dsh-weixin-clawbot-section-title", children: "\u5DE5\u4F5C\u533A\u8BBF\u95EE\u8303\u56F4" }), _jsx("div", { className: "dsh-weixin-clawbot-section-desc", children: "\u52FE\u9009\u673A\u5668\u4EBA\u53EF\u4EE5\u4F7F\u7528\u7684\u5DE5\u4F5C\u533A\uFF1B\u5728\u5FAE\u4FE1\u91CC\u53D1\u9001 /ws \u5207\u6362\u3002" }), _jsx(WorkspaceScopeList, { scope: effectiveScope, disabled: settings === undefined, workspaces: workspaces, onAll: () => applyScope('all'), onToggle: (workspaceId) => {
                                const current = scopeRef.current;
                                const selected = current === 'all' ? [] : current.workspaceIds;
                                const next = selected.includes(workspaceId)
                                    ? selected.filter((id) => id !== workspaceId)
                                    : [...selected, workspaceId];
                                // 取消最后一个工作区 = 回到不限制
                                applyScope(next.length === 0 ? 'all' : { workspaceIds: next });
                            } })] })] }) }));
}
/** 微信 logo 描边图形（白色，放在品牌绿底上）。 */
function WechatGlyph() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "none", stroke: "currentColor", strokeWidth: "1.6", "aria-hidden": "true", children: [_jsx("path", { d: "M8.5 5.5c-3.6 0-6.5 2.4-6.5 5.4 0 1.7.9 3.2 2.4 4.2l-.6 2.1 2.4-1.2c.7.2 1.5.3 2.3.3h.4a5.5 5.5 0 0 1-.2-1.5c0-3 2.9-5.4 6.4-5.4h.5C15.9 7.2 12.5 5.5 8.5 5.5Z" }), _jsx("path", { d: "M15.9 9.5c-3.3 0-6 2.2-6 4.9s2.7 4.9 6 4.9c.7 0 1.3-.1 1.9-.3l2.1 1-.5-1.8c1.3-.9 2.5-2.2 2.5-3.8 0-2.7-2.7-4.9-6-4.9Z" })] }));
}
/** 手机图标（入口用，currentColor）。 */
function PhoneGlyph() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "none", stroke: "currentColor", strokeWidth: "1.6", "aria-hidden": "true", children: [_jsx("rect", { x: "7", y: "2.5", width: "10", height: "19", rx: "2.5" }), _jsx("line", { x1: "11", y1: "18", x2: "13", y2: "18" })] }));
}
/** 侧边栏 footer 的微信入口：rail 显示图标，wide 显示图标 + 文字。 */
function WechatFooterAction(props) {
    const [open, setOpen] = useState(false);
    const { payload, error, refresh } = useQrPoll(open);
    const status = statusOf(payload, error);
    const connected = payload?.state.kind === 'logged-in';
    return (_jsxs(_Fragment, { children: [_jsx(Tooltip, { label: `微信机器人 · ${status.text}`, side: "right", delayMs: 300, children: _jsxs("button", { type: "button", className: `dsh-weixin-clawbot-entry${props.wide ? ' dsh-weixin-clawbot-entry-wide' : ''}`, "aria-haspopup": "dialog", "aria-expanded": open, onClick: () => setOpen(true), children: [_jsx(PhoneGlyph, {}), props.wide && _jsx("span", { children: "\u5FAE\u4FE1" }), connected && _jsx("span", { className: "dsh-weixin-clawbot-badge", "aria-hidden": "true" })] }) }), _jsx(WechatDialog, { open: open, onClose: () => setOpen(false), payload: payload, error: error, refresh: refresh })] }));
}
/** Registers the WeChat entry into the sidebar footer actions slot. */
export function apply(ctx) {
    ctx.effect(() => ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
        name: 'sidebar.footer.action',
        id: 'wechat',
        order: 50,
        inject: () => ({}),
    }, WechatFooterAction)), 'dsh-weixin-clawbot: sidebar footer action');
}
