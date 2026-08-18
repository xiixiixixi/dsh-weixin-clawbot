# 微信配对弹窗重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 dsh-wechat 的 web 扫码弹窗重构成 zcode Bot Channel「微信机器人」管理页的样式与能力：令牌化样式、状态文案人话化、解绑、回复颗粒度、工作区访问范围（对接 `ctx.workspaceRegistry`）。

**Architecture:** host 面新增运行时设置（持久化到 `$DSH_HOME/dsh-wechat.state.json`）+ 两个 POST 路由 + 懒注入 workspaceRegistry；client 面整体重写 `src/client/index.tsx`，样式走真 CSS 文件经 esbuild text-loader 打包、模块顶层注入 `<style data-plugin-css>`（dsh 模块加载器在工厂执行后认领无主 style 标签）。

**Tech Stack:** TypeScript (strict, NodeNext)、React 18、cordis、wechaty、esbuild、vitest。

**Spec:** `docs/superpowers/specs/2026-08-18-wechat-pairing-dialog-design.md`

## Global Constraints

- 颜色/字体只允许 `--dsw-alias-*` / `--dsw-*` 令牌；唯二硬编码色：微信品牌绿 `#07C160`、二维码白底。
- UI 文案中文硬编码，不引入 i18n。
- 不新增 runtime 依赖；`workspaceRegistry` 用本地结构类型，不加 `@deepseek-ai/dsh-workspace` 依赖。
- 样式注入必须在模块顶层（工厂体内），不能放在 `apply()` 里（加载器只在工厂执行后扫一次无主 style 标签）。
- 颗粒度无 state 覆盖时从静态配置推导（`replyOn:'step'+noticeTools:true→'detailed'`、`step+false→'standard'`、`turn→'summary'`），存量用户行为不变。
- 测试沿用 `test/backend.test.ts` 的 mock wechaty 风格（`vi.mock('@juzi/wechaty')` + `fakeBot`）。
- 每个 Task 结束跑 `npm test`，全绿才 commit。

## 关键事实（实现者必读）

- dsh Modal primitive：`Modal({open,onClose,title,closeLabel,description,children,footer,className})`，卡片宽 `min(380px,100%)`、圆角 24；`.body` 内容列宽 332px（左右 padding 24）。
- dsh `Menu({open,anchor,items,selectedId,onSelect,onClose,align,side,portal})`：anchor 是触发元素节点，items 是 `MenuItem|MenuSeparator|MenuLabel` 数组，弹窗内（overflow 裁剪）必须 `portal: true`。
- dsh `StateDot({state:'done'|'warning'|'ongoing'|'error',size})`；`Button({variant:'primary'|'ghost'|'outline'|'toolbar',size:'md'|'sm'})`；`writeClipboard(text): Promise<boolean>`。
- wechaty `ScanStatus`：`Unknown=0 Cancel=1 Waiting=2 Scanned=3 Confirmed=4 Timeout=5`。
- workspaceRegistry 服务：`ctx.workspaceRegistry.list(): Workspace[]`，`Workspace = {id, path, title, ...}`（结构类型即可）。懒注入模式照抄现有 `ctx.inject(['webServer'], ...)`。
- 模块加载器样式认领：`packages/client/modules/src/client/system.ts` 的 `claimStyles` 在工厂执行后把所有无 `data-plugin` 的 `<style>` 归属当前插件。
- smoke 用 `npx -y @deepseek-ai/dsh@0.1.0-rc.7`（npm latest 就是 rc.7；本机无全局 dsh）。profile web 的插件是 `link:/Users/weixili/git/dsh-wechat`，`npm run build` 后直接生效。

---

### Task 1: 运行时设置模块 `src/state.ts`

**Files:**
- Create: `src/state.ts`
- Test: `test/state.test.ts`

**Interfaces:**
- Consumes: `WechatConfig`（`src/config.ts`，已有）
- Produces（后续 Task 依赖的精确签名）:
  - `type Granularity = 'detailed' | 'standard' | 'summary'`
  - `type WorkspaceScope = 'all' | { workspaceId: string }`
  - `type RuntimeOverrides = { granularity?: Granularity; workspaceScope?: WorkspaceScope }`
  - `type WorkspaceLite = { id: string; title: string; path: string }`
  - `resolveStatePath(): string`
  - `loadState(path: string): RuntimeOverrides`
  - `saveState(path: string, overrides: RuntimeOverrides): void`
  - `granularityFromConfig(config: { replyOn: 'step'|'turn'; noticeTools: boolean }): Granularity`
  - `replyOnOf(g: Granularity): 'step'|'turn'`
  - `noticeToolsOf(g: Granularity): boolean`
  - `validateSettingsInput(body: unknown, workspaces: readonly WorkspaceLite[]): { ok: true; patch: RuntimeOverrides } | { ok: false; message: string }`

- [ ] **Step 1: 写失败测试**

```ts
// test/state.test.ts
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  granularityFromConfig,
  loadState,
  noticeToolsOf,
  replyOnOf,
  resolveStatePath,
  saveState,
  validateSettingsInput,
} from '../src/state.js'

const dir = path.join(tmpdir(), `dsh-wechat-state-test-${process.pid}`)
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('granularity 映射', () => {
  it('从静态配置推导', () => {
    expect(granularityFromConfig({ replyOn: 'step', noticeTools: true })).toBe('detailed')
    expect(granularityFromConfig({ replyOn: 'step', noticeTools: false })).toBe('standard')
    expect(granularityFromConfig({ replyOn: 'turn', noticeTools: false })).toBe('summary')
    expect(granularityFromConfig({ replyOn: 'turn', noticeTools: true })).toBe('summary')
  })
  it('granularity → replyOn/noticeTools', () => {
    expect(replyOnOf('detailed')).toBe('step')
    expect(replyOnOf('standard')).toBe('step')
    expect(replyOnOf('summary')).toBe('turn')
    expect(noticeToolsOf('detailed')).toBe(true)
    expect(noticeToolsOf('standard')).toBe(false)
    expect(noticeToolsOf('summary')).toBe(false)
  })
})

describe('state 文件读写', () => {
  it('saveState 原子写入并可读回', () => {
    const file = path.join(dir, 'dsh-wechat.state.json')
    saveState(file, { granularity: 'summary', workspaceScope: { workspaceId: 'w1' } })
    expect(loadState(file)).toEqual({ granularity: 'summary', workspaceScope: { workspaceId: 'w1' } })
  })
  it('saveState 自动创建父目录', () => {
    const file = path.join(dir, 'nested/deep/state.json')
    saveState(file, {})
    expect(loadState(file)).toEqual({})
  })
  it('损坏/缺失文件回退空对象', () => {
    expect(loadState(path.join(dir, 'missing.json'))).toEqual({})
    mkdirSync(dir, { recursive: true })
    writeFileSync(path.join(dir, 'bad.json'), '{oops')
    expect(loadState(path.join(dir, 'bad.json'))).toEqual({})
  })
  it('文件里多余字段被丢弃', () => {
    const file = path.join(dir, 'extra.json')
    mkdirSync(dir, { recursive: true })
    writeFileSync(file, JSON.stringify({ granularity: 'summary', evil: true }))
    expect(loadState(file)).toEqual({ granularity: 'summary' })
  })
  it('resolveStatePath 优先 $DSH_HOME', () => {
    const prev = process.env.DSH_HOME
    process.env.DSH_HOME = '/tmp/dsh-home-x'
    try {
      expect(resolveStatePath()).toBe('/tmp/dsh-home-x/dsh-wechat.state.json')
    } finally {
      if (prev === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = prev
    }
  })
})

describe('validateSettingsInput', () => {
  const workspaces = [
    { id: 'w1', title: 'dsh', path: '/Users/x/git/dsh' },
    { id: 'w2', title: 'sleuth', path: '/Users/x/git/sleuth' },
  ]

  it('接受合法 granularity', () => {
    expect(validateSettingsInput({ granularity: 'summary' }, workspaces)).toEqual({
      ok: true,
      patch: { granularity: 'summary' },
    })
  })
  it('接受 all / 已存在的 workspaceId', () => {
    expect(validateSettingsInput({ workspaceScope: 'all' }, workspaces)).toEqual({
      ok: true,
      patch: { workspaceScope: 'all' },
    })
    expect(validateSettingsInput({ workspaceScope: { workspaceId: 'w2' } }, workspaces)).toEqual({
      ok: true,
      patch: { workspaceScope: { workspaceId: 'w2' } },
    })
  })
  it('拒绝非法枚举/结构/未知工作区/空 body', () => {
    expect(validateSettingsInput({ granularity: 'loud' }, workspaces).ok).toBe(false)
    expect(validateSettingsInput({ workspaceScope: 'some' }, workspaces).ok).toBe(false)
    expect(validateSettingsInput({ workspaceScope: { workspaceId: 'nope' } }, workspaces).ok).toBe(false)
    expect(validateSettingsInput({ workspaceScope: { workspaceId: 'w1' } }, []).ok).toBe(false)
    expect(validateSettingsInput({}, workspaces).ok).toBe(false)
    expect(validateSettingsInput('nonsense', workspaces).ok).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run test/state.test.ts`
Expected: FAIL（`Cannot find module '../src/state.js'`）

- [ ] **Step 3: 实现 `src/state.ts`**

```ts
/**
 * 弹窗运行时设置：颗粒度 / 工作区访问范围的类型、校验与持久化。
 *
 * cordis.patch.yml 里的静态配置是基准值；$DSH_HOME/dsh-wechat.state.json
 * 存用户在弹窗里的运行时覆盖（原子写，读失败回退空对象）。
 *
 * @module dsh-wechat/state
 */

import fs from 'node:fs'
import path from 'node:path'

import type { WechatConfig } from './config.js'

/** 回复颗粒度：详细程度三档（弹窗下拉）。 */
export type Granularity = 'detailed' | 'standard' | 'summary'

/** 工作区访问范围：所有工作区，或绑定到某个工作区 id。 */
export type WorkspaceScope = 'all' | { workspaceId: string }

/** state 文件里的运行时覆盖；字段缺省 = 用静态配置推导。 */
export type RuntimeOverrides = {
  granularity?: Granularity
  workspaceScope?: WorkspaceScope
}

/** workspaceRegistry 记录的 client 投影。 */
export type WorkspaceLite = { id: string; title: string; path: string }

/** state 文件路径：$DSH_HOME/dsh-wechat.state.json（回退 ~/.dsh）。 */
export function resolveStatePath(): string {
  const home = process.env.DSH_HOME ?? (process.env.HOME ? `${process.env.HOME}/.dsh` : '/tmp/.dsh')
  return path.join(home, 'dsh-wechat.state.json')
}

/** 从静态配置推导颗粒度（存量用户行为保持不变）。 */
export function granularityFromConfig(
  config: Pick<WechatConfig, 'replyOn' | 'noticeTools'>,
): Granularity {
  if (config.replyOn === 'turn') return 'summary'
  return config.noticeTools ? 'detailed' : 'standard'
}

/** 颗粒度 → replyOn。 */
export function replyOnOf(granularity: Granularity): 'step' | 'turn' {
  return granularity === 'summary' ? 'turn' : 'step'
}

/** 颗粒度 → noticeTools。 */
export function noticeToolsOf(granularity: Granularity): boolean {
  return granularity === 'detailed'
}

/** 读取运行时覆盖；文件缺失/损坏/多余字段一律安全回退。 */
export function loadState(file: string): RuntimeOverrides {
  let raw: unknown
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
  if (typeof raw !== 'object' || raw === null) return {}
  const record = raw as Record<string, unknown>
  const result: RuntimeOverrides = {}
  if (record.granularity === 'detailed' || record.granularity === 'standard' || record.granularity === 'summary') {
    result.granularity = record.granularity
  }
  if (record.workspaceScope === 'all') {
    result.workspaceScope = 'all'
  } else if (
    typeof record.workspaceScope === 'object' && record.workspaceScope !== null
    && typeof (record.workspaceScope as Record<string, unknown>).workspaceId === 'string'
  ) {
    result.workspaceScope = { workspaceId: (record.workspaceScope as { workspaceId: string }).workspaceId }
  }
  return result
}

/** 原子写入运行时覆盖（临时文件 + rename），自动创建父目录。 */
export function saveState(file: string, overrides: RuntimeOverrides): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, `${JSON.stringify(overrides, null, 2)}\n`)
  fs.renameSync(tmp, file)
}

/**
 * 校验 POST /wechat/settings 的 body。
 * workspaceScope 指定具体工作区时，其 id 必须出现在当前工作区列表里。
 */
export function validateSettingsInput(
  body: unknown,
  workspaces: readonly WorkspaceLite[],
): { ok: true; patch: RuntimeOverrides } | { ok: false; message: string } {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, message: 'body 必须是 JSON 对象' }
  }
  const record = body as Record<string, unknown>
  const patch: RuntimeOverrides = {}

  if ('granularity' in record) {
    if (record.granularity !== 'detailed' && record.granularity !== 'standard' && record.granularity !== 'summary') {
      return { ok: false, message: 'granularity 必须是 detailed / standard / summary' }
    }
    patch.granularity = record.granularity
  }

  if ('workspaceScope' in record) {
    if (record.workspaceScope === 'all') {
      patch.workspaceScope = 'all'
    } else if (
      typeof record.workspaceScope === 'object' && record.workspaceScope !== null
      && typeof (record.workspaceScope as Record<string, unknown>).workspaceId === 'string'
    ) {
      const id = (record.workspaceScope as { workspaceId: string }).workspaceId
      if (!workspaces.some((workspace) => workspace.id === id)) {
        return { ok: false, message: `未知工作区: ${id}` }
      }
      patch.workspaceScope = { workspaceId: id }
    } else {
      return { ok: false, message: "workspaceScope 必须是 'all' 或 { workspaceId }" }
    }
  }

  if (patch.granularity === undefined && patch.workspaceScope === undefined) {
    return { ok: false, message: '至少提供 granularity 或 workspaceScope 之一' }
  }
  return { ok: true, patch }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run test/state.test.ts`
Expected: PASS（全部用例）

- [ ] **Step 5: Commit**

```bash
git add src/state.ts test/state.test.ts
git commit -m "feat(state): 运行时设置模块——颗粒度/工作区范围的类型、校验、原子持久化"
```

---

### Task 2: WechatBackend 接入设置热应用 + 解绑

**Files:**
- Modify: `src/backend.ts`
- Test: `test/backend.test.ts`（扩展）

**Interfaces:**
- Consumes: Task 1 的 `Granularity/WorkspaceScope/RuntimeOverrides/WorkspaceLite/loadState/saveState/granularityFromConfig/replyOnOf/noticeToolsOf/resolveStatePath`
- Produces（Task 3 依赖）:
  - `WechatBackend` 构造签名变为 `constructor(ctx: Context, config: WechatConfig, stateFile?: string)`
  - `backend.workspacesProjection(): WorkspaceLite[]`
  - `backend.setWorkspaceRegistry(registry: { list(): ReadonlyArray<{ id: unknown; title: string; path: string }> } | undefined): void`
  - `backend.effectiveSettings(): { granularity: Granularity; workspaceScope: WorkspaceScope }`
  - `backend.updateSettings(patch: RuntimeOverrides): { granularity: Granularity; workspaceScope: WorkspaceScope }`（合并→持久化→返回生效值）
  - `backend.logout(): Promise<void>`
  - `qrPayload()` 返回扩展载荷（见 Step 3 类型）

- [ ] **Step 1: 写失败测试（追加到 `test/backend.test.ts`）**

在文件末尾追加（沿用文件顶已有的 mock/fakeBot/`makeBackend` 风格；若 `makeBackend` 不存在则参考现有用例的构造方式——`new WechatBackend(ctxMock, Config(), stateFile)`，`ctxMock` 用文件里已有的 fake Context）：

```ts
// ── 运行时设置 / 解绑 ──────────────────────────────────────────

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadState } from '../src/state.js'

function tempStateFile(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-wechat-be-')), 'state.json')
}

describe('WechatBackend 运行时设置', () => {
  it('effectiveSettings 无覆盖时从静态配置推导', async () => {
    const backend = new WechatBackend(ctxMock, { ...Config.parse({}), noticeTools: false }, tempStateFile())
    expect(backend.effectiveSettings()).toEqual({ granularity: 'standard', workspaceScope: 'all' })
  })

  it('updateSettings 持久化并热应用 replyOn/noticeTools', async () => {
    const file = tempStateFile()
    const backend = new WechatBackend(ctxMock, Config.parse({}), file)
    expect(backend.effectiveSettings().granularity).toBe('detailed') // 默认 step+true
    backend.updateSettings({ granularity: 'summary' })
    expect(loadState(file)).toEqual({ granularity: 'summary' })
    expect(backend.effectiveSettings()).toEqual({ granularity: 'summary', workspaceScope: 'all' })
  })

  it('workspaceScope 指定工作区后新 agent 的 cwd 用该工作区 path', async () => {
    const file = tempStateFile()
    const backend = new WechatBackend(ctxMock, Config.parse({ workspace: '/default' }), file)
    backend.setWorkspaceRegistry({
      list: () => [{ id: 'w1' as never, title: 'dsh', path: '/Users/x/git/dsh' }],
    })
    backend.updateSettings({ workspaceScope: { workspaceId: 'w1' } })

    const agent = await backend.getOrCreateAgentForTest('wechat:direct:u1')
    expect(createCalls.at(-1)?.meta?.cwd).toBe('/Users/x/git/dsh')

    // 工作区后来消失：回退 config.workspace，不抛错
    backend.setWorkspaceRegistry({ list: () => [] })
    const agent2 = await backend.getOrCreateAgentForTest('wechat:direct:u2')
    expect(createCalls.at(-1)?.meta?.cwd).toBe('/default')
  })

  it('workspacesProjection 无注册表时为空数组', () => {
    const backend = new WechatBackend(ctxMock, Config.parse({}), tempStateFile())
    expect(backend.workspacesProjection()).toEqual([])
  })

  it('logout 触发 bot.logout 并复位状态', async () => {
    fakeBot.logout = vi.fn(async () => {
      fakeBot.handlers.get('logout')?.({ name: () => 'u', id: 'wxid' } as never)
    })
    const backend = new WechatBackend(ctxMock, Config.parse({}), tempStateFile())
    await backend.start()
    fakeBot.handlers.get('login')?.({ name: () => 'u', id: 'wxid' } as never)
    expect(backend.qrPayload().state.kind).toBe('logged-in')

    await backend.logout()
    expect(fakeBot.logout).toHaveBeenCalled()
    expect(backend.qrPayload().state.kind).toBe('none')
  })

  it('qrPayload 携带 settings/workspaces/puppet', async () => {
    const backend = new WechatBackend(ctxMock, Config.parse({}), tempStateFile())
    backend.setWorkspaceRegistry({
      list: () => [{ id: 'w1' as never, title: 'dsh', path: '/p/dsh' }],
    })
    const payload = backend.qrPayload()
    expect(payload.puppet).toBe('wechaty-puppet-wechat')
    expect(payload.settings.granularity).toBe('detailed')
    expect(payload.settings.workspaceScope).toBe('all')
    expect(payload.workspaces).toEqual([{ id: 'w1', title: 'dsh', path: '/p/dsh' }])
  })
})
```

实现者注意：`ctxMock`、`createCalls`、`getOrCreateAgentForTest` 若文件中尚无，按下面 Step 3 的说明补齐——`getOrCreateAgentForTest` 是给测试开的薄封装（调用私有 `getOrCreateAgent`），`createCalls` 是 mock `ctx.agents.create` 时记录调用的数组。

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run test/backend.test.ts`
Expected: FAIL（`effectiveSettings is not a function` 等）

- [ ] **Step 3: 修改 `src/backend.ts`**

3a. 顶部 import 增加：

```ts
import {
  granularityFromConfig,
  loadState,
  noticeToolsOf,
  replyOnOf,
  resolveStatePath,
  saveState,
  type Granularity,
  type RuntimeOverrides,
  type WorkspaceLite,
  type WorkspaceScope,
} from './state.js'
```

3b. `WechatQrPayload` 类型替换为：

```ts
/** `/wechat/qrcode` 路由的响应载荷。 */
export type WechatQrPayload = {
  ok: boolean
  state: WechatQrState
  /** 扫码备用链接（终端/手机浏览器打开）。 */
  url?: string
  /** 已登录用户信息。 */
  user?: { id: string; name: string }
  /** 当前 puppet 后端包名。 */
  puppet: string
  /** 生效的运行时设置。 */
  settings: { granularity: Granularity; workspaceScope: WorkspaceScope }
  /** workspaceRegistry 投影（无注册表时为空）。 */
  workspaces: WorkspaceLite[]
}
```

3c. 类内新增字段与方法（放在 `qrPayload()` 之后；`ctx` 字段改非只读或直接用构造参数存 stateFile）：

```ts
  /** workspaceRegistry 的最小结构类型：避免新增包依赖。 */
  private workspaceRegistry:
    | { list(): ReadonlyArray<{ id: unknown; title: string; path: string }> }
    | undefined

  private overrides: RuntimeOverrides = {}
  private readonly stateFile: string

  // 构造函数追加第三参：
  // constructor(ctx, config, stateFile = resolveStatePath()) { ...; this.stateFile = stateFile }
  // start() 里 this.overrides = loadState(this.stateFile)

  /** workspaceRegistry 注入/撤销（index.ts 懒注入调用）。 */
  setWorkspaceRegistry(
    registry: { list(): ReadonlyArray<{ id: unknown; title: string; path: string }> } | undefined,
  ): void {
    this.workspaceRegistry = registry
  }

  /** 工作区列表投影（无注册表时空数组）。 */
  workspacesProjection(): WorkspaceLite[] {
    return (this.workspaceRegistry?.list() ?? []).map((workspace) => ({
      id: String(workspace.id),
      title: workspace.title,
      path: workspace.path,
    }))
  }

  /** 当前生效设置：state 覆盖优先，缺省从静态配置推导。 */
  effectiveSettings(): { granularity: Granularity; workspaceScope: WorkspaceScope } {
    return {
      granularity: this.overrides.granularity
        ?? granularityFromConfig(this.config),
      workspaceScope: this.overrides.workspaceScope ?? 'all',
    }
  }

  /** 合并覆盖 → 持久化 → 返回生效值（弹窗 POST /wechat/settings 调用）。 */
  updateSettings(patch: RuntimeOverrides): { granularity: Granularity; workspaceScope: WorkspaceScope } {
    this.overrides = { ...this.overrides, ...patch }
    saveState(this.stateFile, this.overrides)
    return this.effectiveSettings()
  }

  /** 解绑：登出微信、复位扫码状态（幂等）。 */
  async logout(): Promise<void> {
    await this.bot?.logout().catch((error: unknown) =>
      this.log(`[wechat] 解绑失败: ${String(error)}`),
    )
    this.currentUser = undefined
    this.qrState = { kind: 'none' }
  }

  /** 测试可见的 agent 创建入口。 */
  async getOrCreateAgentForTest(sessionId: SessionId): Promise<Agent> {
    return this.getOrCreateAgent(sessionId)
  }
```

3d. 热应用读点替换：

- `onSessionEvent` 里 `this.config.replyOn` → `replyOnOf(this.effectiveSettings().granularity)`（两处：`assistant/message` 与 `turn/end` 分支）；`this.config.noticeTools` → `noticeToolsOf(this.effectiveSettings().granularity)`。
- `getOrCreateAgent` 里 `meta: { cwd: this.config.workspace }` → `meta: { cwd: this.agentCwd() }`，新增：

```ts
  /** 新微信会话的 cwd：范围选定工作区优先（注册表消失时回退静态配置）。 */
  private agentCwd(): string {
    const scope = this.effectiveSettings().workspaceScope
    if (scope !== 'all') {
      const hit = this.workspacesProjection().find((workspace) => workspace.id === scope.workspaceId)
      if (hit) return hit.path
    }
    return this.config.workspace
  }
```

3e. `qrPayload()` 各 return 补齐新字段（`puppet: this.config.puppet`、`settings: this.effectiveSettings()`、`workspaces: this.workspacesProjection()`）；`dispose()` 里 `await this.logout()` 替换现有 bot.stop 前的状态复位。

3f. `fakeBot`（test 文件）补 `logout`：在 Task 2 Step 1 的用例里就地 `vi.fn` 挂上即可（已在测试代码中体现）。

- [ ] **Step 4: 跑测试确认通过（含存量 43 例）**

Run: `npm test`
Expected: PASS（全部）

- [ ] **Step 5: Commit**

```bash
git add src/backend.ts test/backend.test.ts
git commit -m "feat(backend): 设置热应用（颗粒度/工作区 cwd）+ 解绑 + qrPayload 扩展"
```

---

### Task 3: 路由注册 + workspaceRegistry 懒注入

**Files:**
- Modify: `src/index.ts`
- Test: 复用 `test/state.test.ts` 的 `validateSettingsInput` 覆盖（路由层保持薄，不新增路由单测）

**Interfaces:**
- Consumes: Task 2 的 `backend.updateSettings/workspacesProjection/logout`；Task 1 的 `validateSettingsInput`
- Produces: HTTP API——
  - `POST /wechat/settings` body `{granularity?, workspaceScope?}` → 200 `{ok:true, settings}` / 400 `{ok:false, message}`
  - `POST /wechat/logout` → 200 `{ok:true}`
  - `GET /wechat/qrcode` 载荷含 `puppet/settings/workspaces`（Task 2 已实现）

- [ ] **Step 1: 修改 `src/index.ts`**

在现有 `ctx.inject(['webServer'], ...)` 块内、`/wechat/qrcode` 路由注册之后追加两个路由与 body 读取助手；在 webServer 注入块**之外**追加 workspaceRegistry 懒注入：

```ts
/** 读取并解析 JSON body（限制 64KB）。 */
function readJsonBody(req: import('node:http').IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > 64 * 1024) {
        req.destroy()
        resolve(undefined)
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined)
      } catch {
        resolve(undefined)
      }
    })
    req.on('error', () => resolve(undefined))
  })
}
```

webServer 注入块内追加：

```ts
    const json = (res: import('node:http').ServerResponse, status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(body))
    }

    webCtx.effect(() => webCtx.webServer.register({
      kind: 'exact',
      path: '/wechat/settings',
      handler: async (req, res) => {
        const body = await readJsonBody(req)
        const verdict = validateSettingsInput(body, backend.workspacesProjection())
        if (!verdict.ok) {
          json(res, 400, { ok: false, message: verdict.message })
          return
        }
        json(res, 200, { ok: true, settings: backend.updateSettings(verdict.patch) })
      },
    } satisfies WebRoute), 'dsh-wechat: /wechat/settings route')

    webCtx.effect(() => webCtx.webServer.register({
      kind: 'exact',
      path: '/wechat/logout',
      handler: async (_req, res) => {
        await backend.logout()
        json(res, 200, { ok: true })
      },
    } satisfies WebRoute), 'dsh-wechat: /wechat/logout route')
```

webServer 块之外追加（与 webServer 同款懒注入模式）：

```ts
  // workspaceRegistry 可选注入：注册表上线时把工作区列表接进后端；
  // headless 等没有注册表的 profile 不影响微信功能（下拉退化为「所有工作区」）。
  ctx.inject(['workspaceRegistry'], (regCtx) => {
    backend.setWorkspaceRegistry(regCtx.workspaceRegistry)
    regCtx.effect(() => () => backend.setWorkspaceRegistry(undefined), 'dsh-wechat: workspaceRegistry unbind')
  })
```

同时：`import { validateSettingsInput } from './state.js'` 加入顶部 import；`export { ... } from './state.js'` 补充到公开导出（`Granularity/WorkspaceScope/RuntimeOverrides/WorkspaceLite/validateSettingsInput/loadState/saveState`）。

- [ ] **Step 2: 类型检查 + 全量测试**

Run: `npm run typecheck && npm test`
Expected: 全部 PASS（存量 + 新增）

- [ ] **Step 3: 构建 host 产物冒烟**

Run: `npm run build:host && node -e "import('./lib/index.js').then(m => console.log(typeof m.apply, m.QRCODE_ROUTE_PATH))"`
Expected: 打印 `function /wechat/qrcode`

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat(routes): POST /wechat/settings + /wechat/logout，workspaceRegistry 懒注入"
```

---

### Task 4: client 构建管道（css text-loader + tsx 类型检查）

**Files:**
- Modify: `scripts/build-client.mjs`
- Modify: `tsconfig.json`（include 加 `src/**/*.tsx`）
- Create: `src/client/shims.d.ts`
- Modify: `package.json`（devDependencies 加 `@deepseek-ai/dsh-client-ui-primitives`）

**Interfaces:**
- Consumes: 无
- Produces: `import cssText from './wechat.css'` 类型为 string；`npm run build` 产出包含 CSS 文本与全部 UI 的 `lib/client.js`（Task 5/6 依赖此管道）

- [ ] **Step 1: `scripts/build-client.mjs` 加 loader**

`await build({...})` 参数追加：

```js
  loader: { '.css': 'text' },
```

- [ ] **Step 2: `src/client/shims.d.ts`**

```ts
/** client 构建用 esbuild text-loader 内联 CSS 文本。 */
declare module '*.css' {
  const text: string
  export default text
}
```

- [ ] **Step 3: `tsconfig.json` include 追加 tsx**

```json
  "include": [
    "src/**/*.ts",
    "src/**/*.tsx",
    "test/**/*.ts"
  ]
```

- [ ] **Step 4: `package.json` devDependencies 追加（当前仅传递依赖，直接 import 应显式声明）**

```json
    "@deepseek-ai/dsh-client-ui-primitives": "^0.1.0-rc.7",
```

然后 `npm install` 刷新 lockfile。

- [ ] **Step 5: 验证管道**

Run: `npm install && npm run typecheck && npm run build`
Expected: typecheck PASS（现 client 代码也应无错）；`lib/client.js` 正常产出

- [ ] **Step 6: Commit**

```bash
git add scripts/build-client.mjs tsconfig.json src/client/shims.d.ts package.json package-lock.json
git commit -m "build(client): css text-loader + tsx 纳入类型检查 + 显式 ui-primitives devDep"
```

---

### Task 5: 样式表 `src/client/wechat.css`

**Files:**
- Create: `src/client/wechat.css`

**Interfaces:**
- Produces: 类名（Task 6 直接使用）——
  `.dsh-wechat-dialog`（Modal className，扩宽到 420）、`.dsh-wechat-header`、`.dsh-wechat-logo`、`.dsh-wechat-title`、`.dsh-wechat-subtitle`、`.dsh-wechat-statusline`、`.dsh-wechat-section`、`.dsh-wechat-section-title`、`.dsh-wechat-section-desc`、`.dsh-wechat-qr-card`、`.dsh-wechat-qr-img`、`.dsh-wechat-qr-hint`、`.dsh-wechat-linkrow`、`.dsh-wechat-linkbtn`、`.dsh-wechat-connected`、`.dsh-wechat-connected-name`、`.dsh-wechat-connected-id`、`.dsh-wechat-note`、`.dsh-wechat-row`、`.dsh-wechat-row-text`、`.dsh-wechat-row-label`、`.dsh-wechat-row-desc`、`.dsh-wechat-select`、`.dsh-wechat-footer-cap`、`.dsh-wechat-badge`（入口图标连通角标）、`.dsh-wechat-entry`（入口按钮）

- [ ] **Step 1: 写完整 CSS**

```css
/*
 * dsh-wechat 弹窗与侧边栏入口样式。
 * 颜色/字体全部走 --dsw-alias-* 令牌（深浅色自动适配）；
 * 唯二硬编码色：微信品牌绿 #07C160（logo）与二维码白底（可扫性要求）。
 */

/* ── 侧边栏入口 ─────────────────────────────────────────── */

.dsh-wechat-entry {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  font: inherit;
  font-size: 14px;
}

.dsh-wechat-entry:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

/* 连通角标：图标右下角 8px 绿点 */
.dsh-wechat-badge {
  position: absolute;
  right: 7px;
  bottom: 7px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dsw-alias-state-success-primary);
  box-shadow: 0 0 0 2px var(--dsw-alias-bg-layer-1);
}

/* ── 弹窗（挂 Modal className，卡片从 380 扩到 420） ─────── */

.dsh-wechat-dialog {
  width: min(420px, 100%);
}

.dsh-wechat-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dsh-wechat-logo {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: #07c160; /* 微信品牌绿 */
  color: #fff;
}

.dsh-wechat-title {
  margin: 0;
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary);
}

.dsh-wechat-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary);
}

/* 状态行：StateDot + 文案 */
.dsh-wechat-statusline {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 16px;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary);
}

/* ── 分区（关联机器人 / 颗粒度 / 工作区范围） ────────────── */

.dsh-wechat-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--dsw-alias-border-l1);
}

.dsh-wechat-section-title {
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary);
}

.dsh-wechat-section-desc {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}

/* ── 二维码卡片 ─────────────────────────────────────────── */

.dsh-wechat-qr-card {
  align-self: center;
  margin-top: 8px;
  padding: 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 16px;
  background: #fff; /* 二维码可扫性要求白底 */
}

.dsh-wechat-qr-img {
  display: block;
  width: 220px;
  height: 220px;
}

.dsh-wechat-qr-hint {
  align-self: center;
  margin-top: 8px;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}

/* 「无法扫码？」链接行 */
.dsh-wechat-linkrow {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary);
}

.dsh-wechat-linkbtn {
  border: none;
  padding: 0;
  background: none;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.dsh-wechat-linkbtn:hover {
  color: var(--dsw-alias-label-primary);
  text-decoration: underline;
}

/* ── 已连通 ─────────────────────────────────────────────── */

.dsh-wechat-connected {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  padding: 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
}

.dsh-wechat-connected-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dsh-wechat-connected-name {
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary);
}

.dsh-wechat-connected-id {
  font-size: 12px;
  line-height: 18px;
  font-family: var(--ds-font-family-code);
  color: var(--dsw-alias-label-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 首条消息提示框 */
.dsh-wechat-note {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
}

/* ── 设置行（标题/描述 左，控件 右） ───────────────────── */

.dsh-wechat-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
}

.dsh-wechat-row-text {
  flex: 1;
  min-width: 0;
}

.dsh-wechat-row-label {
  font-size: 14px;
  line-height: 22px;
  color: var(--dsw-alias-label-primary);
}

.dsh-wechat-row-desc {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}

/* 下拉触发按钮（Menu 的 anchor） */
.dsh-wechat-select {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  max-width: 200px;
}

.dsh-wechat-select:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}

.dsh-wechat-select-label {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* 底部 caption：puppet 名 */
.dsh-wechat-footer-cap {
  margin-top: 16px;
  font-size: 11px;
  line-height: 16px;
  color: var(--dsw-alias-label-dimmed, var(--dsw-alias-label-tertiary));
  text-align: center;
}
```

- [ ] **Step 2: 构建验证（css 尚未 import，先保证语法可打包）**

Run: `node scripts/build-client.mjs`（若 import 报缺失属预期，Task 6 接线）
Expected: 无 CSS 语法错误相关输出

- [ ] **Step 3: Commit**

```bash
git add src/client/wechat.css
git commit -m "style(client): dsh-wechat 弹窗/入口样式表（全令牌化）"
```

---

### Task 6: client UI 重写 `src/client/index.tsx`

**Files:**
- Modify: `src/client/index.tsx`（整体重写）

**Interfaces:**
- Consumes: Task 4 管道（`import cssText from './wechat.css'`）、Task 5 类名、dsh primitives（`Modal/Menu/Button/StateDot/Tooltip/writeClipboard`）、Task 2/3 的 HTTP API 与 `WechatQrPayload`
- Produces: 对外导出不变——`export const inject = ['slots']`、`export function apply(ctx: ClientContext): void`

- [ ] **Step 1: 重写文件**

```tsx
/**
 * dsh-wechat 的浏览器半部分：侧边栏「微信机器人」入口 + 配对管理弹窗。
 *
 * 弹窗对齐 zcode Bot Channel 微信管理页：关联机器人（扫码/解绑）、
 * 回复颗粒度、工作区访问范围。轮询 GET /wechat/qrcode，
 * 设置写入 POST /wechat/settings，解绑 POST /wechat/logout。
 *
 * @module dsh-wechat/client
 */

import { useCallback, useEffect, useRef, useState, type JSX } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
// 引入 ui-sidebar 的 SlotMap 声明合并与 footer action owner props 类型。
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { SidebarFooterActionOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import {
  Button,
  IconCheckOutline14,
  IconChevronDownOutline14,
  IconCopyOutline16,
  IconRightUpOutline14,
  Menu,
  Modal,
  StateDot,
  Tooltip,
  writeClipboard,
} from '@deepseek-ai/dsh-client-ui-primitives'

import type { WechatQrPayload } from '../backend.js'
import cssText from './wechat.css'

// 模块加载器在工厂执行后立即认领此时存在的无主 <style> 标签，
// 因此注入必须发生在模块顶层（工厂体内）而不是 apply() 里。
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.setAttribute('data-plugin-css', 'dsh-wechat')
  document.head.append(style)
  style.textContent = cssText
}

/** Services required by the client plugin. */
export const inject = ['slots']

/** 轮询载荷（与主机 WechatQrPayload 一致）。 */
type QrPayload = WechatQrPayload
type Granularity = QrPayload['settings']['granularity']
type WorkspaceLite = QrPayload['workspaces'][number]

const GRANULARITY_LABELS: Record<Granularity, string> = {
  detailed: '完整回复',
  standard: '标准回复',
  summary: '摘要回复',
}

const GRANULARITY_ITEMS: Array<{ id: Granularity; label: string }> = [
  { id: 'detailed', label: GRANULARITY_LABELS.detailed },
  { id: 'standard', label: GRANULARITY_LABELS.standard },
  { id: 'summary', label: GRANULARITY_LABELS.summary },
]

/** wechaty ScanStatus（0/1/2/3/4/5）→ 用户可读文案；不暴露状态码。 */
function scanHint(status: number): string {
  if (status === 3) return '已扫码，请在手机上确认'
  if (status === 4) return '已确认，正在登录…'
  if (status === 5 || status === 1) return '二维码已过期，正在获取新码…'
  return '等待手机扫码'
}

/** 整体状态：StateDot 语义 + 一行文案（状态行与入口 tooltip 共用）。 */
function statusOf(payload: QrPayload | null, error: string | null): { dot: 'done' | 'warning' | 'ongoing' | 'error'; text: string } {
  if (error !== null) return { dot: 'error', text: '连接中断，正在重试…' }
  if (payload === null) return { dot: 'ongoing', text: '微信后端启动中…' }
  switch (payload.state.kind) {
    case 'none': return { dot: 'ongoing', text: '微信后端启动中…' }
    case 'scan': return { dot: 'ongoing', text: scanHint(payload.state.status) }
    case 'logged-in': return { dot: 'done', text: `已连通：${payload.user?.name ?? payload.state.userName}` }
  }
}

/** 轮询 /wechat/qrcode；open 时 2s，否则 10s。 */
function useQrPoll(open: boolean): { payload: QrPayload | null; error: string | null; refresh: () => void } {
  const [payload, setPayload] = useState<QrPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    const poll = async () => {
      try {
        const response = await fetch('/wechat/qrcode', { cache: 'no-store' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = (await response.json()) as QrPayload
        if (alive.current) {
          setPayload(data)
          setError(null)
        }
      } catch (err) {
        if (alive.current) setError(String(err))
      }
    }
    void poll()
    const timer = setInterval(() => void poll(), open ? 2000 : 10000)
    return () => {
      alive.current = false
      clearInterval(timer)
    }
  }, [open, tick])

  const refresh = useCallback(() => setTick((value) => value + 1), [])
  return { payload, error, refresh }
}

async function postJson(path: string, body?: unknown): Promise<boolean> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return response.ok
  } catch {
    return false
  }
}

/** 设置行：左侧标题/描述，右侧控件。 */
function SettingRow(props: { label: string; desc: string; children: JSX.Element }): JSX.Element {
  return (
    <div className="dsh-wechat-row">
      <div className="dsh-wechat-row-text">
        <div className="dsh-wechat-row-label">{props.label}</div>
        <div className="dsh-wechat-row-desc">{props.desc}</div>
      </div>
      {props.children}
    </div>
  )
}

/** 下拉选择（dsh Menu primitive，portal 防弹窗裁剪）。 */
function DropdownSelect(props: {
  label: string
  options: ReadonlyArray<{ id: string; label: string; desc?: string }>
  value: string
  onSelect: (id: string) => void
  disabled?: boolean
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const selected = props.options.find((option) => option.id === props.value)
  return (
    <Menu
      open={open}
      onClose={() => setOpen(false)}
      portal
      align="end"
      items={props.options.map((option) => ({
        id: option.id,
        label: option.desc !== undefined ? `${option.label}（${option.desc}）` : option.label,
      }))}
      selectedId={props.value}
      onSelect={(id) => {
        setOpen(false)
        if (id !== props.value) props.onSelect(id)
      }}
      anchor={
        <button
          type="button"
          className="dsh-wechat-select"
          disabled={props.disabled}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="dsh-wechat-select-label">{selected?.label ?? props.label}</span>
          <IconChevronDownOutline14 size={14} />
        </button>
      }
    />
  )
}

/** 配对管理弹窗主体。 */
function WechatDialog(props: {
  open: boolean
  onClose: () => void
  payload: QrPayload | null
  error: string | null
  refresh: () => void
}): JSX.Element {
  const [copied, setCopied] = useState(false)
  const status = statusOf(props.payload, props.error)
  const state = props.payload?.state
  const settings = props.payload?.settings
  const workspaces = props.payload?.workspaces ?? []

  const scopeValue = settings !== undefined && settings.workspaceScope !== 'all'
    ? settings.workspaceScope.workspaceId
    : 'all'
  const scopeOptions = [
    { id: 'all', label: '所有工作区' },
    ...workspaces.map((workspace) => ({
      id: workspace.id,
      label: workspace.title,
      desc: workspace.path,
    })),
  ]

  const copyLink = async () => {
    if (props.payload?.url === undefined) return
    if (await writeClipboard(props.payload.url)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const updateSettings = async (patch: Record<string, unknown>) => {
    if (await postJson('/wechat/settings', patch)) props.refresh()
  }

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="微信机器人"
      closeLabel="关闭"
      className="dsh-wechat-dialog"
    >
      <div className="dsh-wechat-header">
        <span className="dsh-wechat-logo" aria-hidden="true">
          <WechatGlyph />
        </span>
        <div>
          <h2 className="dsh-wechat-title">微信机器人</h2>
          <p className="dsh-wechat-subtitle">在微信里远程操控 DSH agent。</p>
        </div>
      </div>

      <div className="dsh-wechat-statusline">
        <StateDot state={status.dot} />
        <span>{status.text}</span>
      </div>

      <div className="dsh-wechat-section">
        <div className="dsh-wechat-section-title">关联机器人</div>
        <div className="dsh-wechat-section-desc">扫码后自动保存凭据。</div>

        {state?.kind === 'scan' && (
          <>
            <div className="dsh-wechat-qr-card">
              {state.png ? (
                <img className="dsh-wechat-qr-img" src={state.png} alt="微信登录二维码" />
              ) : (
                <div className="dsh-wechat-qr-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 13 }}>
                  二维码生成中…
                </div>
              )}
            </div>
            <div className="dsh-wechat-qr-hint">{scanHint(state.status)}</div>
            {props.payload?.url !== undefined && (
              <div className="dsh-wechat-linkrow">
                <span>无法扫码？在手机浏览器打开链接</span>
                <button type="button" className="dsh-wechat-linkbtn" onClick={() => void copyLink()}>
                  {copied ? <IconCheckOutline14 size={14} /> : <IconCopyOutline16 size={14} />}
                  {copied ? '已复制' : '复制'}
                </button>
                <a
                  className="dsh-wechat-linkbtn"
                  href={props.payload.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <IconRightUpOutline14 size={14} />
                </a>
              </div>
            )}
          </>
        )}

        {state?.kind === 'logged-in' && (
          <>
            <div className="dsh-wechat-connected">
              <StateDot state="done" />
              <div className="dsh-wechat-connected-main">
                <span className="dsh-wechat-connected-name">
                  {props.payload?.user?.name ?? state.userName}
                </span>
                <span className="dsh-wechat-connected-id">{state.userId}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => { void postJson('/wechat/logout').then(props.refresh) }}>
                解绑
              </Button>
            </div>
            <div className="dsh-wechat-note">
              <span>ⓘ</span>
              <span>请在微信里向机器人发送任意消息；首次消息会收到欢迎和帮助。</span>
            </div>
          </>
        )}

        {(state === undefined || state.kind === 'none') && (
          <div className="dsh-wechat-qr-hint">等待微信后端就绪后显示二维码…</div>
        )}
      </div>

      <div className="dsh-wechat-section">
        <div className="dsh-wechat-section-title">机器人回复颗粒度</div>
        <SettingRow label="消息详细程度" desc="控制机器人回复的详细程度。">
          <DropdownSelect
            label="标准回复"
            options={GRANULARITY_ITEMS}
            value={settings?.granularity ?? 'standard'}
            disabled={settings === undefined}
            onSelect={(id) => { void updateSettings({ granularity: id }) }}
          />
        </SettingRow>
      </div>

      <div className="dsh-wechat-section">
        <div className="dsh-wechat-section-title">工作区访问范围</div>
        <SettingRow label="可用工作区" desc="限制机器人可以在哪些工作区里工作。">
          <DropdownSelect
            label="所有工作区"
            options={scopeOptions}
            value={scopeValue}
            disabled={settings === undefined}
            onSelect={(id) => {
              void updateSettings({
                workspaceScope: id === 'all' ? 'all' : { workspaceId: id },
              })
            }}
          />
        </SettingRow>
      </div>

      {props.payload?.puppet !== undefined && (
        <div className="dsh-wechat-footer-cap">后端：{props.payload.puppet}</div>
      )}
    </Modal>
  )
}

/** 微信 logo 描边图形（白色，放在品牌绿底上）。 */
function WechatGlyph(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M8.5 5.5c-3.6 0-6.5 2.4-6.5 5.4 0 1.7.9 3.2 2.4 4.2l-.6 2.1 2.4-1.2c.7.2 1.5.3 2.3.3h.4a5.5 5.5 0 0 1-.2-1.5c0-3 2.9-5.4 6.4-5.4h.5C15.9 7.2 12.5 5.5 8.5 5.5Z" />
      <path d="M15.9 9.5c-3.3 0-6 2.2-6 4.9s2.7 4.9 6 4.9c.7 0 1.3-.1 1.9-.3l2.1 1-.5-1.8c1.3-.9 2.5-2.2 2.5-3.8 0-2.7-2.7-4.9-6-4.9Z" />
    </svg>
  )
}

/** 手机图标（入口用，currentColor）。 */
function PhoneGlyph(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <line x1="11" y1="18" x2="13" y2="18" />
    </svg>
  )
}

/** 侧边栏 footer 的微信入口：rail 显示图标，wide 显示图标 + 文字。 */
function WechatFooterAction(props: SidebarFooterActionOwnerProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const { payload, error, refresh } = useQrPoll(open)
  const status = statusOf(payload, error)
  const connected = payload?.state.kind === 'logged-in'

  return (
    <>
      <Tooltip label={`微信机器人 · ${status.text}`} side="right" delayMs={300}>
        <button
          type="button"
          className="dsh-wechat-entry"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <PhoneGlyph />
          {props.wide && <span>微信</span>}
          {connected && <span className="dsh-wechat-badge" aria-hidden="true" />}
        </button>
      </Tooltip>
      <WechatDialog open={open} onClose={() => setOpen(false)} payload={payload} error={error} refresh={refresh} />
    </>
  )
}

/** Registers the WeChat entry into the sidebar footer actions slot. */
export function apply(ctx: ClientContext): void {
  ctx.effect(
    () =>
      ctx.slots.inject('sidebar.footer.action', () =>
        ctx.slots.register({
          name: 'sidebar.footer.action',
          id: 'wechat',
          order: 50,
          inject: () => ({}),
        }, WechatFooterAction)),
    'dsh-wechat: sidebar footer action',
  )
}
```

实现者注意：
- Modal 自带 header/title/close chrome，因此 `WechatDialog` 里不再自绘关闭钮；`dsh-wechat-header` 里保留 logo+标题是视觉主体（Modal 的 `title` 只做 aria-label 与隐藏标题行，实际标题行由 `headless` 与否决定——如与 Modal 默认 header 重复，可给 Modal 传 `headless` 并完全自绘 header，二选一以视觉冒烟结果为准，代码按 `headless` 版预留：给 Modal 加 `headless` 并在 `dsh-wechat-header` 行尾自行放关闭按钮 `<button className={css.close}>`；采用 headless 时须保留 Escape/遮罩逻辑由 Modal 提供）。
- 若 `IconCopyOutline16`/`IconRightUpOutline14` 等 icon 名在 primitives 中不存在（以 `node -e "console.log(Object.keys(require('@deepseek-ai/dsh-client-ui-primitives')))"` 或类型检查为准），就近替换为存在的等价 icon（如 `IconCopyOutline14` 不存在时用文字「复制」不带 icon）。

- [ ] **Step 2: 类型检查 + 构建**

Run: `npm run typecheck && npm run build`
Expected: PASS；`grep -c 'dsh-wechat-entry' lib/client.js` 输出 ≥1（CSS 文本已进包）

- [ ] **Step 3: 全量测试**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/client/index.tsx
git commit -m "feat(client): 微信机器人管理弹窗——扫码/解绑/颗粒度/工作区范围，样式全令牌化"
```

---

### Task 7: 冒烟验证（真实 dsh web + 浏览器）+ README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: 全部前序 Task
- Produces: 验证记录（截图）+ 更新的 README

- [ ] **Step 1: 隔离环境起真实 dsh web**

```bash
rm -rf /tmp/dsh-wechat-smoke && mkdir -p /tmp/dsh-wechat-smoke
cd ~/.dsh/profiles/web && DSH_HOME=/tmp/dsh-wechat-smoke npx -y @deepseek-ai/dsh@0.1.0-rc.7 plugin --profile web add /Users/weixili/git/dsh-wechat
# 把 examples/cordis.patch.example.yml 的 insert 条目写进 /tmp/dsh-wechat-smoke/profiles/web/cordis.patch.yml（puppet 用 wechaty-puppet-wechat4u）
DSH_HOME=/tmp/dsh-wechat-smoke npx -y @deepseek-ai/dsh@0.1.0-rc.7 --profile web --port 31789 &
```

Expected: 日志出现 `[wechat] 已启动（puppet: wechaty-puppet-wechat4u）` 或扫码日志

- [ ] **Step 2: 浏览器冒烟（chrome-devtools MCP）**

1. `navigate_page` → `http://localhost:31789`
2. 点击侧边栏「微信」入口 → 弹窗打开
3. 核对并截图：二维码卡片、状态行、颗粒度下拉三档、工作区范围下拉（先在主界面「选择工作区」建 1-2 个工作区让下拉有数据）、复制链接反馈
4. 深色模式切换后再截图一轮
5. `list_console_messages` 确认无报错

Expected: 弹窗视觉与 zcode 管理页同构；无 console 错误

- [ ] **Step 3: 设置写回验证**

弹窗切「摘要回复」→ `cat /tmp/dsh-wechat-smoke/dsh-wechat.state.json` 出现 `"granularity": "summary"`；刷新页面后下拉停在「摘要回复」。

- [ ] **Step 4: 更新 README**

- 「使用」章节新增「Web 端配对弹窗」小节（入口、四态、解绑、颗粒度、工作区范围、state 文件路径）
- 配置表 `noticeTools`/`replyOn` 行注明「弹窗里可被运行时设置覆盖（$DSH_HOME/dsh-wechat.state.json）」
- 「后端选择」段落删除「启动后按 DSH 日志里的二维码用微信扫码登录」改为「启动后在 Web 端侧边栏微信入口扫码登录」

- [ ] **Step 5: 收尾**

Run: `npm test && npm run typecheck && npm run build`
Expected: 全绿

```bash
git add README.md
git commit -m "docs: Web 端配对弹窗使用说明与运行时设置说明"
```

---

## Self-Review 记录

- Spec 覆盖：弹窗结构（Task 5/6）、状态文案映射（Task 6 `scanHint`/`statusOf`）、解绑（Task 2/3/6）、颗粒度（Task 1/2/3/6）、工作区范围（Task 1/2/3/6）、样式令牌化（Task 5）、CSS 注入时机（Task 4/6）、持久化（Task 1/2）、测试（Task 1/2 + Task 7 冒烟）——无缺口。
- 类型一致性：`Granularity/WorkspaceScope/RuntimeOverrides/WorkspaceLite` 贯穿 Task 1→2→3→6；`QrPayload['settings']`/`['workspaces']` 从 host 类型推导，client 不重复定义。
- 已知风险：Modal headless 与默认 header 二选一（Task 6 注意事项里给了决策规则）；icon 名以类型检查为准就近替换。
