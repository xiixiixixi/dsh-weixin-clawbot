window.__ModuleLoader__.load({ id: "dsh-weixin-clawbot", factory: function (require) { var module = { exports: {} }; var exports = module.exports; Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/wechat.css
var wechat_default = "/*\n * dsh-weixin-clawbot \u5F39\u7A97\u4E0E\u4FA7\u8FB9\u680F\u5165\u53E3\u6837\u5F0F\u3002\n * \u989C\u8272/\u5B57\u4F53\u5168\u90E8\u8D70 --dsw-alias-* \u4EE4\u724C\uFF08\u6DF1\u6D45\u8272\u81EA\u52A8\u9002\u914D\uFF09\uFF1B\n * \u552F\u4E8C\u786C\u7F16\u7801\u8272\uFF1A\u5FAE\u4FE1\u54C1\u724C\u7EFF #07C160\uFF08logo\uFF09\u4E0E\u4E8C\u7EF4\u7801\u767D\u5E95\uFF08\u53EF\u626B\u6027\u8981\u6C42\uFF09\u3002\n */\n\n/* \u2500\u2500 \u4FA7\u8FB9\u680F\u5165\u53E3 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n\n.dsh-weixin-clawbot-entry {\n  position: relative;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  width: 36px;\n  height: 36px;\n  border: none;\n  border-radius: 50%;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  cursor: pointer;\n  font: inherit;\n  font-size: 14px;\n}\n\n.dsh-weixin-clawbot-entry:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-primary);\n}\n\n/* \u5BBD\u4FA7\u680F\uFF1A\u4E0E\u8BBE\u7F6E\u884C\u4E00\u81F4\u7684 34px \u5706\u89D2\u884C */\n.dsh-weixin-clawbot-entry-wide {\n  width: auto;\n  height: 34px;\n  margin: 4px -4px 4px;\n  padding: 0 10px;\n  border-radius: 12px;\n}\n\n/* \u8FDE\u901A\u89D2\u6807\uFF1A\u56FE\u6807\u53F3\u4E0B\u89D2 8px \u7EFF\u70B9 */\n.dsh-weixin-clawbot-badge {\n  position: absolute;\n  right: 7px;\n  bottom: 7px;\n  width: 8px;\n  height: 8px;\n  border-radius: 50%;\n  background: var(--dsw-alias-state-success-primary);\n  box-shadow: 0 0 0 2px var(--dsw-alias-bg-layer-1);\n}\n\n/* \u2500\u2500 \u5F39\u7A97\uFF08\u6302 Modal className\uFF0C\u5361\u7247\u4ECE 380 \u6269\u5230 420\uFF09 \u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n\n.dsh-weixin-clawbot-dialog {\n  width: min(420px, 100%);\n}\n\n/* headless \u6A21\u5F0F\u81EA\u7ED8 frame\uFF1A\u5DE6\u53F3 24 / \u4E0A 22 \u7684\u5185\u5BB9\u8FB9\u8DDD */\n.dsh-weixin-clawbot-frame {\n  display: flex;\n  flex-direction: column;\n  padding: 22px 24px 0;\n}\n\n/* \u81EA\u7ED8\u5173\u95ED\u94AE\uFF08\u5BF9\u9F50 Modal \u9ED8\u8BA4 header \u7684 close \u89C4\u683C\uFF09 */\n.dsh-weixin-clawbot-close {\n  flex: none;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 28px;\n  height: 28px;\n  border: none;\n  border-radius: 8px;\n  background: transparent;\n  cursor: pointer;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.dsh-weixin-clawbot-close:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.dsh-weixin-clawbot-header {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n}\n\n.dsh-weixin-clawbot-header-main {\n  flex: 1;\n  min-width: 0;\n}\n\n.dsh-weixin-clawbot-logo {\n  flex: none;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 32px;\n  height: 32px;\n  border-radius: 10px;\n  background: #07c160; /* \u5FAE\u4FE1\u54C1\u724C\u7EFF */\n  color: #fff;\n}\n\n.dsh-weixin-clawbot-title {\n  margin: 0;\n  font-size: 16px;\n  line-height: 24px;\n  font-weight: 500;\n  color: var(--dsw-alias-label-primary);\n}\n\n.dsh-weixin-clawbot-subtitle {\n  margin: 4px 0 0;\n  font-size: 13px;\n  line-height: 20px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n/* \u72B6\u6001\u884C\uFF1AStateDot + \u6587\u6848 */\n.dsh-weixin-clawbot-statusline {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  margin-top: 16px;\n  font-size: 13px;\n  line-height: 20px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n/* \u2500\u2500 \u5206\u533A\uFF08\u5173\u8054\u673A\u5668\u4EBA / \u9897\u7C92\u5EA6 / \u5DE5\u4F5C\u533A\u8303\u56F4\uFF09 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n\n.dsh-weixin-clawbot-section {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  margin-top: 20px;\n  padding-top: 16px;\n  border-top: 1px solid var(--dsw-alias-border-l1);\n}\n\n.dsh-weixin-clawbot-section-title {\n  font-size: 14px;\n  line-height: 22px;\n  font-weight: 500;\n  color: var(--dsw-alias-label-primary);\n}\n\n.dsh-weixin-clawbot-section-desc {\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n/* \u2500\u2500 \u4E8C\u7EF4\u7801\u5361\u7247 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n\n.dsh-weixin-clawbot-qr-card {\n  align-self: center;\n  margin-top: 8px;\n  padding: 12px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 16px;\n  background: #fff; /* \u4E8C\u7EF4\u7801\u53EF\u626B\u6027\u8981\u6C42\u767D\u5E95 */\n}\n\n.dsh-weixin-clawbot-qr-img {\n  display: block;\n  width: 220px;\n  height: 220px;\n}\n\n.dsh-weixin-clawbot-qr-hint {\n  align-self: center;\n  margin-top: 8px;\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n/* \u300C\u65E0\u6CD5\u626B\u7801\uFF1F\u300D\u94FE\u63A5\u884C */\n.dsh-weixin-clawbot-linkrow {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  margin-top: 10px;\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.dsh-weixin-clawbot-linkbtn {\n  border: none;\n  padding: 0;\n  background: none;\n  color: var(--dsw-alias-label-secondary);\n  font: inherit;\n  font-size: 12px;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  text-decoration: none;\n}\n\n.dsh-weixin-clawbot-linkbtn:hover {\n  color: var(--dsw-alias-label-primary);\n  text-decoration: underline;\n}\n\n/* \u2500\u2500 \u5DF2\u8FDE\u901A \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n\n.dsh-weixin-clawbot-connected {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  margin-top: 8px;\n  padding: 12px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-1);\n}\n\n.dsh-weixin-clawbot-connected-main {\n  flex: 1;\n  min-width: 0;\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n}\n\n.dsh-weixin-clawbot-connected-name {\n  font-size: 14px;\n  line-height: 22px;\n  font-weight: 500;\n  color: var(--dsw-alias-label-primary);\n}\n\n.dsh-weixin-clawbot-connected-id {\n  font-size: 12px;\n  line-height: 18px;\n  font-family: var(--ds-font-family-code);\n  color: var(--dsw-alias-label-tertiary);\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n/* \u9996\u6761\u6D88\u606F\u63D0\u793A\u6846 */\n.dsh-weixin-clawbot-note {\n  display: flex;\n  gap: 8px;\n  margin-top: 10px;\n  padding: 10px 12px;\n  border-radius: 10px;\n  background: var(--dsw-alias-bg-layer-1);\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n/* \u2500\u2500 \u8BBE\u7F6E\u884C\uFF08\u6807\u9898/\u63CF\u8FF0 \u5DE6\uFF0C\u63A7\u4EF6 \u53F3\uFF09 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n\n.dsh-weixin-clawbot-row {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  margin-top: 6px;\n}\n\n.dsh-weixin-clawbot-row-text {\n  flex: 1;\n  min-width: 0;\n}\n\n.dsh-weixin-clawbot-row-label {\n  font-size: 14px;\n  line-height: 22px;\n  color: var(--dsw-alias-label-primary);\n}\n\n.dsh-weixin-clawbot-row-desc {\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n/* \u4E0B\u62C9\u89E6\u53D1\u6309\u94AE\uFF08Menu \u7684 anchor\uFF09 */\n.dsh-weixin-clawbot-select {\n  flex: none;\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  height: 30px;\n  padding: 0 10px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 10px;\n  background: var(--dsw-alias-bg-layer-1);\n  color: var(--dsw-alias-label-primary);\n  font: inherit;\n  font-size: 13px;\n  cursor: pointer;\n  max-width: 200px;\n}\n\n.dsh-weixin-clawbot-select:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.dsh-weixin-clawbot-select:disabled {\n  cursor: default;\n  opacity: 0.6;\n}\n\n.dsh-weixin-clawbot-select-label {\n  overflow: hidden;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n}\n\n/* \u2500\u2500 \u5DE5\u4F5C\u533A\u591A\u9009\u5217\u8868\uFF08zcode \u540C\u6B3E checkbox \u884C\uFF09 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n\n.dsh-weixin-clawbot-check-list {\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  margin-top: 6px;\n}\n\n.dsh-weixin-clawbot-check-row {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  width: 100%;\n  padding: 7px 8px;\n  border: none;\n  border-radius: 10px;\n  background: none;\n  font: inherit;\n  text-align: left;\n  cursor: pointer;\n}\n\n.dsh-weixin-clawbot-check-row:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.dsh-weixin-clawbot-check-row:disabled {\n  cursor: default;\n  opacity: 0.6;\n}\n\n.dsh-weixin-clawbot-check-box {\n  flex: none;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 16px;\n  height: 16px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 5px;\n  background: var(--dsw-alias-bg-layer-1);\n  color: var(--dsw-alias-label-primary-foreground, #fff);\n}\n\n.dsh-weixin-clawbot-check-box[data-checked='true'] {\n  border-color: transparent;\n  background: var(--dsw-alias-brand-primary);\n}\n\n.dsh-weixin-clawbot-check-text {\n  flex: 1;\n  min-width: 0;\n  display: flex;\n  align-items: baseline;\n  gap: 8px;\n}\n\n.dsh-weixin-clawbot-check-title {\n  font-size: 13px;\n  line-height: 20px;\n  color: var(--dsw-alias-label-primary);\n}\n\n.dsh-weixin-clawbot-check-path {\n  flex: 1;\n  min-width: 0;\n  font-size: 11px;\n  line-height: 16px;\n  font-family: var(--ds-font-family-code);\n  color: var(--dsw-alias-label-tertiary);\n  overflow: hidden;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n}\n\n.dsh-weixin-clawbot-check-empty {\n  padding: 7px 8px;\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n/* \u2500\u2500 iLink \u914D\u5BF9\u7801\u8F93\u5165\u884C \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n\n.dsh-weixin-clawbot-verify {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  margin-top: 10px;\n  padding: 10px 12px;\n  border-radius: 10px;\n  background: var(--dsw-alias-bg-layer-1);\n}\n\n.dsh-weixin-clawbot-verify-label {\n  flex: none;\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.dsh-weixin-clawbot-verify-input {\n  width: 90px;\n  height: 30px;\n  padding: 0 10px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-primary);\n  font: inherit;\n  font-size: 13px;\n  font-family: var(--ds-font-family-code);\n}\n\n.dsh-weixin-clawbot-verify-input:focus {\n  outline: none;\n  border-color: var(--dsw-alias-brand-primary);\n}\n";

// src/client/index.tsx
var import_jsx_runtime = require("react/jsx-runtime");
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.setAttribute("data-plugin-css", "dsh-weixin-clawbot");
  document.head.append(style);
  style.textContent = wechat_default;
}
var inject = ["slots"];
var GRANULARITY_ITEMS = [
  { id: "detailed", label: "\u5B8C\u6574\u56DE\u590D" },
  { id: "standard", label: "\u6807\u51C6\u56DE\u590D" },
  { id: "summary", label: "\u6458\u8981\u56DE\u590D" }
];
function scanHint(status) {
  if (status === 3) return "\u5DF2\u626B\u7801\uFF0C\u8BF7\u5728\u624B\u673A\u4E0A\u786E\u8BA4";
  if (status === 4) return "\u5DF2\u786E\u8BA4\uFF0C\u6B63\u5728\u767B\u5F55\u2026";
  if (status === 5 || status === 1) return "\u4E8C\u7EF4\u7801\u5DF2\u8FC7\u671F\uFF0C\u6B63\u5728\u83B7\u53D6\u65B0\u7801\u2026";
  return "\u7B49\u5F85\u624B\u673A\u626B\u7801";
}
function statusOf(payload, error) {
  if (error !== null) return { dot: "error", text: "\u8FDE\u63A5\u4E2D\u65AD\uFF0C\u6B63\u5728\u91CD\u8BD5\u2026" };
  if (payload === null) return { dot: "ongoing", text: "\u5FAE\u4FE1\u540E\u7AEF\u542F\u52A8\u4E2D\u2026" };
  switch (payload.state.kind) {
    case "none":
      return { dot: "ongoing", text: "\u5FAE\u4FE1\u540E\u7AEF\u542F\u52A8\u4E2D\u2026" };
    case "scan":
      return { dot: "ongoing", text: scanHint(payload.state.status) };
    case "logged-in":
      return {
        dot: "done",
        text: `\u5DF2\u8FDE\u901A\uFF1A${payload.user?.name ?? payload.state.userName}`
      };
  }
}
function useQrPoll(open) {
  const [payload, setPayload] = (0, import_react.useState)(null);
  const [error, setError] = (0, import_react.useState)(null);
  const [tick, setTick] = (0, import_react.useState)(0);
  const alive = (0, import_react.useRef)(true);
  (0, import_react.useEffect)(() => {
    alive.current = true;
    const poll = async () => {
      try {
        const response = await fetch("/wechat/qrcode", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (alive.current) {
          setPayload(data);
          setError(null);
        }
      } catch (err) {
        if (alive.current) setError(String(err));
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), open ? 2e3 : 1e4);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, [open, tick]);
  const refresh = (0, import_react.useCallback)(() => setTick((value) => value + 1), []);
  return { payload, error, refresh };
}
async function postJson(path, body) {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body === void 0 ? void 0 : JSON.stringify(body)
    });
    return response.ok;
  } catch {
    return false;
  }
}
function SettingRow(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-weixin-clawbot-row", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-weixin-clawbot-row-text", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-weixin-clawbot-row-label", children: props.label }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-weixin-clawbot-row-desc", children: props.desc })
    ] }),
    props.children
  ] });
}
function DropdownSelect(props) {
  const [open, setOpen] = (0, import_react.useState)(false);
  const selected = props.options.find((option) => option.id === props.value);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_dsh_client_ui_primitives.Menu,
    {
      open,
      onClose: () => setOpen(false),
      portal: true,
      align: "end",
      items: props.options.map((option) => ({
        id: option.id,
        label: option.desc !== void 0 ? `${option.label}\uFF08${option.desc}\uFF09` : option.label
      })),
      selectedId: props.value,
      onSelect: (id) => {
        setOpen(false);
        if (id !== props.value) props.onSelect(id);
      },
      anchor: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "button",
        {
          type: "button",
          className: "dsh-weixin-clawbot-select",
          disabled: props.disabled,
          onClick: () => setOpen((value) => !value),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-weixin-clawbot-select-label", children: selected?.label ?? props.label }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconChevronDownOutline14, { size: 14 })
          ]
        }
      )
    }
  );
}
function WorkspaceScopeList(props) {
  const scope = props.scope;
  const isAll = scope === "all";
  const selected = isAll ? [] : scope.workspaceIds;
  const row = (props2) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "button",
    {
      type: "button",
      className: "dsh-weixin-clawbot-check-row",
      disabled: props.disabled,
      role: "menuitemcheckbox",
      "aria-checked": props2.checked,
      onClick: props2.onToggle,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-weixin-clawbot-check-box", "data-checked": props2.checked, children: props2.checked && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconCheckOutline14, { size: 12 }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dsh-weixin-clawbot-check-text", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-weixin-clawbot-check-title", children: props2.title }),
          props2.path !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-weixin-clawbot-check-path", children: props2.path })
        ] })
      ]
    },
    props2.key
  );
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-weixin-clawbot-check-list", role: "group", "aria-label": "\u5DE5\u4F5C\u533A\u8BBF\u95EE\u8303\u56F4", children: [
    row({
      key: "all",
      checked: isAll,
      title: "\u6240\u6709\u5DE5\u4F5C\u533A",
      onToggle: () => {
        if (!isAll) props.onAll();
      }
    }),
    props.workspaces.map(
      (workspace) => row({
        key: workspace.id,
        checked: selected.includes(workspace.id),
        title: workspace.title,
        path: workspace.path,
        onToggle: () => props.onToggle(workspace.id)
      })
    ),
    props.workspaces.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-weixin-clawbot-check-empty", children: "DSH \u91CC\u8FD8\u6CA1\u6709\u5DF2\u6CE8\u518C\u7684\u5DE5\u4F5C\u533A\u3002" })
  ] });
}
function VerifyCodeRow(props) {
  const [code, setCode] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  if (props.state === "blocked") {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-weixin-clawbot-note", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "aria-hidden": "true", children: "\u26D4" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u914D\u5BF9\u7801\u591A\u6B21\u8F93\u5165\u9519\u8BEF\uFF0C\u8BF7\u7A0D\u540E\u7B49\u4E8C\u7EF4\u7801\u81EA\u52A8\u5237\u65B0\u540E\u91CD\u8BD5\u3002" })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-weixin-clawbot-verify", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-weixin-clawbot-verify-label", children: props.state === "wrong" ? "\u274C \u914D\u5BF9\u7801\u4E0D\u6B63\u786E\uFF0C\u8BF7\u91CD\u65B0\u8F93\u5165\uFF1A" : "\u8F93\u5165\u624B\u673A\u5FAE\u4FE1\u4E0A\u663E\u793A\u7684\u6570\u5B57\uFF0C\u5B8C\u6210\u914D\u5BF9\uFF1A" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "input",
      {
        className: "dsh-weixin-clawbot-verify-input",
        value: code,
        inputMode: "numeric",
        autoFocus: true,
        placeholder: "\u914D\u5BF9\u7801",
        onChange: (event) => setCode(event.target.value),
        onKeyDown: (event) => {
          if (event.key === "Enter" && code.trim() !== "" && !busy) {
            setBusy(true);
            void postJson("/wechat/verify", { code: code.trim() }).finally(() => setBusy(false));
          }
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "button",
      {
        type: "button",
        className: "dsh-weixin-clawbot-select",
        disabled: code.trim() === "" || busy,
        onClick: () => {
          setBusy(true);
          void postJson("/wechat/verify", { code: code.trim() }).finally(() => setBusy(false));
        },
        children: "\u63D0\u4EA4"
      }
    )
  ] });
}
function WechatDialog(props) {
  const [copied, setCopied] = (0, import_react.useState)(false);
  const [optimisticScope, setOptimisticScope] = (0, import_react.useState)(null);
  const status = statusOf(props.payload, props.error);
  const state = props.payload?.state;
  const settings = props.payload?.settings;
  const workspaces = props.payload?.workspaces ?? [];
  const effectiveScope = optimisticScope ?? settings?.workspaceScope ?? "all";
  (0, import_react.useEffect)(() => {
    if (optimisticScope !== null && JSON.stringify(settings?.workspaceScope) === JSON.stringify(optimisticScope)) {
      setOptimisticScope(null);
    }
  }, [settings, optimisticScope]);
  const scopeRef = (0, import_react.useRef)(effectiveScope);
  scopeRef.current = effectiveScope;
  const applyScope = (next) => {
    scopeRef.current = next;
    setOptimisticScope(next);
    void postJson("/wechat/settings", { workspaceScope: next }).then((ok) => {
      if (ok) props.refresh();
      else setOptimisticScope(null);
    });
  };
  const copyLink = async () => {
    if (props.payload?.url === void 0) return;
    if (await (0, import_dsh_client_ui_primitives.writeClipboard)(props.payload.url)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2e3);
    }
  };
  const updateSettings = async (patch) => {
    if (await postJson("/wechat/settings", patch)) props.refresh();
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_dsh_client_ui_primitives.Modal,
    {
      open: props.open,
      onClose: props.onClose,
      title: "\u5FAE\u4FE1\u673A\u5668\u4EBA",
      closeLabel: "\u5173\u95ED",
      className: "dsh-weixin-clawbot-dialog",
      headless: true,
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-weixin-clawbot-frame", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-weixin-clawbot-header", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-weixin-clawbot-logo", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WechatGlyph, {}) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-weixin-clawbot-header-main", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { className: "dsh-weixin-clawbot-title", children: "\u5FAE\u4FE1\u673A\u5668\u4EBA" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsh-weixin-clawbot-subtitle", children: "\u5728\u5FAE\u4FE1\u91CC\u8FDC\u7A0B\u64CD\u63A7 DSH agent\u3002" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dsh-weixin-clawbot-close", "aria-label": "\u5173\u95ED", onClick: props.onClose, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconCloseOutline16, { size: 14 }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-weixin-clawbot-statusline", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.StateDot, { state: status.dot }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: status.text })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-weixin-clawbot-section", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-weixin-clawbot-section-title", children: "\u5173\u8054\u673A\u5668\u4EBA" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-weixin-clawbot-section-desc", children: "\u626B\u7801\u540E\u81EA\u52A8\u4FDD\u5B58\u51ED\u636E\u3002" }),
          state?.kind === "scan" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-weixin-clawbot-qr-card", children: state.png ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", { className: "dsh-weixin-clawbot-qr-img", src: state.png, alt: "\u5FAE\u4FE1\u767B\u5F55\u4E8C\u7EF4\u7801" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "div",
              {
                className: "dsh-weixin-clawbot-qr-img",
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#888",
                  fontSize: 13
                },
                children: "\u4E8C\u7EF4\u7801\u751F\u6210\u4E2D\u2026"
              }
            ) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-weixin-clawbot-qr-hint", children: scanHint(state.status) }),
            state.verifyCode !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VerifyCodeRow, { state: state.verifyCode }),
            props.payload?.url !== void 0 && state.verifyCode === void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-weixin-clawbot-linkrow", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u65E0\u6CD5\u626B\u7801\uFF1F\u5728\u624B\u673A\u6D4F\u89C8\u5668\u6253\u5F00\u94FE\u63A5" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { type: "button", className: "dsh-weixin-clawbot-linkbtn", onClick: () => void copyLink(), children: [
                copied ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconCheckOutline14, { size: 14 }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconCopyOutline16, { size: 14 }),
                copied ? "\u5DF2\u590D\u5236" : "\u590D\u5236"
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "a",
                {
                  className: "dsh-weixin-clawbot-linkbtn",
                  href: props.payload.url,
                  target: "_blank",
                  rel: "noopener noreferrer",
                  children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconRightUpOutline14, { size: 14 })
                }
              )
            ] })
          ] }),
          state?.kind === "logged-in" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-weixin-clawbot-connected", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.StateDot, { state: "done" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-weixin-clawbot-connected-main", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-weixin-clawbot-connected-name", children: props.payload?.user?.name ?? state.userName }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-weixin-clawbot-connected-id", children: state.userId })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "button",
                {
                  type: "button",
                  className: "dsh-weixin-clawbot-select",
                  onClick: () => {
                    void postJson("/wechat/logout").then(props.refresh);
                  },
                  children: "\u89E3\u7ED1"
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-weixin-clawbot-note", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "aria-hidden": "true", children: "\u24D8" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u8BF7\u5728\u5FAE\u4FE1\u91CC\u5411\u673A\u5668\u4EBA\u53D1\u9001\u4EFB\u610F\u6D88\u606F\uFF1B\u9996\u6B21\u6D88\u606F\u4F1A\u6536\u5230\u6B22\u8FCE\u548C\u5E2E\u52A9\u3002" })
            ] })
          ] }),
          (state === void 0 || state.kind === "none") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-weixin-clawbot-qr-hint", children: "\u7B49\u5F85\u5FAE\u4FE1\u540E\u7AEF\u5C31\u7EEA\u540E\u663E\u793A\u4E8C\u7EF4\u7801\u2026" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-weixin-clawbot-section", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-weixin-clawbot-section-title", children: "\u673A\u5668\u4EBA\u56DE\u590D\u9897\u7C92\u5EA6" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SettingRow, { label: "\u6D88\u606F\u8BE6\u7EC6\u7A0B\u5EA6", desc: "\u63A7\u5236\u673A\u5668\u4EBA\u56DE\u590D\u7684\u8BE6\u7EC6\u7A0B\u5EA6\u3002", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            DropdownSelect,
            {
              label: "\u6807\u51C6\u56DE\u590D",
              options: GRANULARITY_ITEMS,
              value: settings?.granularity ?? "standard",
              disabled: settings === void 0,
              onSelect: (id) => {
                void updateSettings({ granularity: id });
              }
            }
          ) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-weixin-clawbot-section", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-weixin-clawbot-section-title", children: "\u5DE5\u4F5C\u533A\u8BBF\u95EE\u8303\u56F4" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-weixin-clawbot-section-desc", children: "\u52FE\u9009\u673A\u5668\u4EBA\u53EF\u4EE5\u4F7F\u7528\u7684\u5DE5\u4F5C\u533A\uFF1B\u5728\u5FAE\u4FE1\u91CC\u53D1\u9001 /ws \u5207\u6362\u3002" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            WorkspaceScopeList,
            {
              scope: effectiveScope,
              disabled: settings === void 0,
              workspaces,
              onAll: () => applyScope("all"),
              onToggle: (workspaceId) => {
                const current = scopeRef.current;
                const selected = current === "all" ? [] : current.workspaceIds;
                const next = selected.includes(workspaceId) ? selected.filter((id) => id !== workspaceId) : [...selected, workspaceId];
                applyScope(next.length === 0 ? "all" : { workspaceIds: next });
              }
            }
          )
        ] })
      ] })
    }
  );
}
function WechatGlyph() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "svg",
    {
      viewBox: "0 0 24 24",
      width: "18",
      height: "18",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.6",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8.5 5.5c-3.6 0-6.5 2.4-6.5 5.4 0 1.7.9 3.2 2.4 4.2l-.6 2.1 2.4-1.2c.7.2 1.5.3 2.3.3h.4a5.5 5.5 0 0 1-.2-1.5c0-3 2.9-5.4 6.4-5.4h.5C15.9 7.2 12.5 5.5 8.5 5.5Z" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M15.9 9.5c-3.3 0-6 2.2-6 4.9s2.7 4.9 6 4.9c.7 0 1.3-.1 1.9-.3l2.1 1-.5-1.8c1.3-.9 2.5-2.2 2.5-3.8 0-2.7-2.7-4.9-6-4.9Z" })
      ]
    }
  );
}
function PhoneGlyph() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "svg",
    {
      viewBox: "0 0 24 24",
      width: "18",
      height: "18",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.6",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "7", y: "2.5", width: "10", height: "19", rx: "2.5" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", { x1: "11", y1: "18", x2: "13", y2: "18" })
      ]
    }
  );
}
function WechatFooterAction(props) {
  const [open, setOpen] = (0, import_react.useState)(false);
  const { payload, error, refresh } = useQrPoll(open);
  const status = statusOf(payload, error);
  const connected = payload?.state.kind === "logged-in";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Tooltip, { label: `\u5FAE\u4FE1\u673A\u5668\u4EBA \xB7 ${status.text}`, side: "right", delayMs: 300, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "button",
      {
        type: "button",
        className: `dsh-weixin-clawbot-entry${props.wide ? " dsh-weixin-clawbot-entry-wide" : ""}`,
        "aria-haspopup": "dialog",
        "aria-expanded": open,
        onClick: () => setOpen(true),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PhoneGlyph, {}),
          props.wide && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u5FAE\u4FE1" }),
          connected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-weixin-clawbot-badge", "aria-hidden": "true" })
        ]
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      WechatDialog,
      {
        open,
        onClose: () => setOpen(false),
        payload,
        error,
        refresh
      }
    )
  ] });
}
function apply(ctx) {
  ctx.effect(
    () => ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
      name: "sidebar.footer.action",
      id: "wechat",
      order: 50,
      inject: () => ({})
    }, WechatFooterAction)),
    "dsh-weixin-clawbot: sidebar footer action"
  );
}
return module.exports; } });
