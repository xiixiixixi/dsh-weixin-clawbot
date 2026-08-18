import { describe, expect, it, vi, beforeEach } from 'vitest'

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { AssistantMessage } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'

import { WechatBackend } from '../src/backend.js'
import { Config } from '../src/config.js'
import type { WechatConfig } from '../src/config.js'

// ── mock wechaty 层 ─────────────────────────────────────────────

const { messageType } = vi.hoisted(() => ({
  messageType: {
    Unknown: 0,
    Text: 7,
    Image: 6,
    Audio: 2,
    Video: 15,
    Attachment: 1,
  },
}))

type EventHandler = (payload: never) => void | Promise<void>

const fakeBot = {
  handlers: new Map<string, EventHandler>(),
  sent: [] as string[],
  on(name: string, handler: EventHandler) {
    this.handlers.set(name, handler)
    return this
  },
  async start() {},
  async stop() {},
  logout: vi.fn(async () => {}),
  Contact: {
    async find(): Promise<{ say: (text: string) => Promise<void> }> {
      return {
        say: async (text: string) => {
          fakeBot.sent.push(text)
        },
      }
    },
  },
  Room: {
    async find(): Promise<undefined> {
      return undefined
    },
  },
}

vi.mock('@juzi/wechaty', () => ({
  WechatyBuilder: { build: () => fakeBot },
  types: { Message: messageType },
}))

// ── 测试夹具 ────────────────────────────────────────────────────

function makeMessage(overrides: Record<string, unknown> = {}) {
  return {
    self: () => false,
    talker: () => ({ id: 'wxid_abc', name: () => '张三' }),
    room: () => undefined,
    text: () => '你好',
    type: () => messageType.Text,
    date: () => new Date(),
    mentionSelf: () => false,
    toFileBox: async () => undefined,
    ...overrides,
  }
}

function makeAgent(followup: ReturnType<typeof vi.fn>): Agent {
  return {
    id: SessionId('wechat:direct:wxid_abc'),
    options: {},
    session: {} as unknown as Session,
    inbox: {} as unknown as Agent['inbox'],
    status: 'idle',
    ctx: {} as unknown as Context,
    followup,
    steer: followup,
    inject: followup,
    cancel: vi.fn(),
    whenIdle: async () => {},
    runMaintenance: async <T>(job: (signal: AbortSignal) => Promise<T>): Promise<T> =>
      job(new AbortController().signal),
  } as unknown as Agent
}

function makeContext(overrides: Partial<Record<string, unknown>> = {}) {
  const followup = vi.fn()
  const dispose = vi.fn(async () => {})
  const listeners = new Map<string, (session: Session, event: SessionEvent) => void>()
  const ctx = {
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    on: (name: string, handler: never) => {
      listeners.set(name, handler)
      return () => listeners.delete(name)
    },
    effect: () => () => {},
    agents: {
      create: vi.fn(async () => ({ agent: makeAgent(followup), dispose })),
    },
    agentDefaultModel: {
      currentSelection: () => ({ provider: 'deepseek-official', model: 'deepseek-v4-flash' }),
    },
    ...overrides,
  } as unknown as Context
  return { ctx, followup, dispose, listeners }
}

function makeConfig(): WechatConfig {
  return Config({
    puppet: '@juzi/wechaty-puppet-service',
    dmPolicy: 'open',
    noticeTools: false,
  } as unknown as WechatConfig)
}

function assistantEvent(text: string): SessionEvent {
  return {
    seq: 3,
    type: 'assistant/message',
    data: {
      turn: 1,
      step: 1,
      message: {
        role: 'assistant',
        content: [{ type: 'text', text }],
      } as AssistantMessage,
    },
  } as unknown as SessionEvent
}

describe('WechatBackend', () => {
  beforeEach(() => {
    fakeBot.sent.length = 0
  })

  it('入站私聊 → 创建 agent 并 followup', async () => {
    const { ctx, followup } = makeContext()
    const backend = new WechatBackend(ctx, makeConfig())
    await backend.start()

    const onMessage = fakeBot.handlers.get('message')
    expect(onMessage).toBeDefined()
    await (onMessage as (m: never) => Promise<void>)(makeMessage() as never)

    expect(ctx.agents.create).toHaveBeenCalledTimes(1)
    expect(followup).toHaveBeenCalledTimes(1)
    const message = followup.mock.calls[0][0]
    expect(message.content[0].text).toBe('你好')
    expect(message.source.kind).toBe('user')

    await backend.dispose()
  })

  it('assistant/message 事件 → 微信回复', async () => {
    const { ctx, listeners } = makeContext()
    const backend = new WechatBackend(ctx, makeConfig())
    await backend.start()

    // 先有一条入站建立会话
    const onMessage = fakeBot.handlers.get('message')
    await (onMessage as (m: never) => Promise<void>)(makeMessage() as never)

    const session = { id: SessionId('wechat:direct:wxid_abc'), events: [] } as unknown as Session
    const onSessionEvent = listeners.get('session/event')
    expect(onSessionEvent).toBeDefined()
    onSessionEvent!(session, assistantEvent('你好呀，我是 DSH'))

    await vi.waitFor(() => expect(fakeBot.sent).toEqual(['你好呀，我是 DSH']))

    await backend.dispose()
  })

  it('非本插件会话的事件被忽略', async () => {
    const { ctx, listeners } = makeContext()
    const backend = new WechatBackend(ctx, makeConfig())
    await backend.start()

    const onSessionEvent = listeners.get('session/event')
    const session = { id: SessionId('session-other'), events: [] } as unknown as Session
    await onSessionEvent!(session, assistantEvent('不应被发送'))

    expect(fakeBot.sent).toHaveLength(0)

    await backend.dispose()
  })

  it('/new 命令销毁旧会话', async () => {
    const { ctx, followup, dispose } = makeContext()
    const backend = new WechatBackend(ctx, makeConfig())
    await backend.start()

    const onMessage = fakeBot.handlers.get('message')
    await (onMessage as (m: never) => Promise<void>)(makeMessage({ text: () => '你好' }) as never)
    await (onMessage as (m: never) => Promise<void>)(makeMessage({ text: () => '/new' }) as never)

    expect(dispose).toHaveBeenCalled()
    expect(fakeBot.sent).toContain('已开始新会话。')
    expect(followup).toHaveBeenCalledTimes(1) // 命令不进入 agent

    await backend.dispose()
  })

  it('pairing 策略下陌生人收到配对提示且不创建 agent', async () => {
    const { ctx, followup } = makeContext()
    const backend = new WechatBackend(
      ctx,
      Config({ puppet: '@juzi/wechaty-puppet-service', dmPolicy: 'pairing' } as unknown as WechatConfig),
    )
    await backend.start()

    const onMessage = fakeBot.handlers.get('message')
    await (onMessage as (m: never) => Promise<void>)(makeMessage() as never)

    expect(ctx.agents.create).not.toHaveBeenCalled()
    expect(followup).not.toHaveBeenCalled()
    expect(fakeBot.sent.join(' ')).toContain('访问权限')

    await backend.dispose()
  })

  it('重复入站复用同一会话', async () => {
    const { ctx, followup } = makeContext()
    const backend = new WechatBackend(ctx, makeConfig())
    await backend.start()

    const onMessage = fakeBot.handlers.get('message')
    await (onMessage as (m: never) => Promise<void>)(makeMessage() as never)
    await (onMessage as (m: never) => Promise<void>)(makeMessage({ text: () => '第二条' }) as never)

    expect(ctx.agents.create).toHaveBeenCalledTimes(1)
    expect(followup).toHaveBeenCalledTimes(2)

    await backend.dispose()
  })
})

// ── 运行时设置 / 解绑 ──────────────────────────────────────────

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadState } from '../src/state.js'
import type { RuntimeOverrides } from '../src/state.js'
import { sessionIdFor, subjectFromSessionId } from '../src/sessions.js'
import type { Mock } from 'vitest'

function tempStateFile(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-wechat-be-')), 'state.json')
}

function lastCreateArg(ctx: Context): { meta?: { cwd?: string } } {
  return (ctx.agents.create as Mock).mock.calls.at(-1)?.[0]
}

describe('WechatBackend 运行时设置', () => {
  beforeEach(() => {
    fakeBot.sent.length = 0
    fakeBot.logout.mockClear()
  })

  it('effectiveSettings 无覆盖时从静态配置推导', () => {
    const { ctx } = makeContext()
    const backend = new WechatBackend(ctx, makeConfig(), tempStateFile())
    expect(backend.effectiveSettings()).toEqual({ granularity: 'standard', workspaceScope: 'all' })
  })

  it('updateSettings 持久化并热应用 replyOn/noticeTools', () => {
    const file = tempStateFile()
    const { ctx } = makeContext()
    const backend = new WechatBackend(
      ctx,
      Config({ puppet: '@juzi/wechaty-puppet-service', noticeTools: true } as unknown as WechatConfig),
      file,
    )
    expect(backend.effectiveSettings().granularity).toBe('detailed') // 默认 step+true
    backend.updateSettings({ granularity: 'summary' })
    expect(loadState(file)).toEqual<RuntimeOverrides>({ granularity: 'summary' })
    expect(backend.effectiveSettings()).toEqual({ granularity: 'summary', workspaceScope: 'all' })
  })

  it('workspaceScope 多选：默认 cwd = 第一个勾选工作区；/ws 切换后落到对应会话', async () => {
    const { ctx } = makeContext()
    const backend = new WechatBackend(
      ctx,
      Config({ puppet: '@juzi/wechaty-puppet-service', workspace: '/default', dmPolicy: 'open' } as unknown as WechatConfig),
      tempStateFile(),
    )
    backend.setWorkspaceRegistry({
      list: () => [
        { id: 'w1' as never, title: 'dsh', path: '/p/dsh' },
        { id: 'w2' as never, title: 'sleuth', path: '/p/sleuth' },
      ],
    })
    backend.updateSettings({ workspaceScope: { workspaceIds: ['w2', 'w1'] } })
    await backend.start()

    const onMessage = fakeBot.handlers.get('message')
    fakeBot.sent.length = 0
    // 默认路由到第一个勾选的工作区 w2
    await (onMessage as (m: never) => Promise<void>)(makeMessage({ text: () => '你好' }) as never)
    expect(lastCreateArg(ctx).meta?.cwd).toBe('/p/sleuth')
    expect(String((ctx.agents.create as Mock).mock.calls.at(-1)?.[0].sessionId)).toBe(
      'wechat:direct:wxid_abc#w2',
    )

    // /ws 列表 → /ws 1 切换 → 下条消息进入 w1 会话
    fakeBot.sent.length = 0
    await (onMessage as (m: never) => Promise<void>)(makeMessage({ text: () => '/ws' }) as never)
    expect(fakeBot.sent.join(' ')).toContain('sleuth')
    await (onMessage as (m: never) => Promise<void>)(makeMessage({ text: () => '/ws dsh' }) as never)
    expect(fakeBot.sent.join(' ')).toContain('已切换到「dsh」')
    fakeBot.sent.length = 0
    await (onMessage as (m: never) => Promise<void>)(makeMessage({ text: () => '继续' }) as never)
    expect(lastCreateArg(ctx).meta?.cwd).toBe('/p/dsh')
    expect(String((ctx.agents.create as Mock).mock.calls.at(-1)?.[0].sessionId)).toBe(
      'wechat:direct:wxid_abc#w1',
    )

    // 两个工作区的会话并存（第一条消息在 w2，切换后落在 w1）
    expect((ctx.agents.create as Mock).mock.calls.length).toBe(2)

    await backend.dispose()
  })

  it('/ws 未勾选任何工作区时提示去 Web 弹窗配置', async () => {
    const { ctx } = makeContext()
    const backend = new WechatBackend(ctx, makeConfig(), tempStateFile())
    await backend.start()
    const onMessage = fakeBot.handlers.get('message')
    fakeBot.sent.length = 0
    await (onMessage as (m: never) => Promise<void>)(makeMessage({ text: () => '/ws' }) as never)
    expect(fakeBot.sent.join(' ')).toContain('没有可选择的工作区')
    await backend.dispose()
  })

  it('带工作区后缀的会话 id 能反推微信主体', () => {
    expect(subjectFromSessionId('wechat:direct:wxid_abc#w1')).toEqual({ kind: 'direct', id: 'wxid_abc' })
    expect(String(sessionIdFor({ kind: 'direct', id: 'wxid_abc' }, 'w1'))).toBe('wechat:direct:wxid_abc#w1')
    expect(String(sessionIdFor({ kind: 'group', id: 'r@chatroom' }))).toBe('wechat:group:r@chatroom')
  })

  it('workspacesProjection 无注册表时为空数组', () => {
    const { ctx } = makeContext()
    const backend = new WechatBackend(ctx, makeConfig(), tempStateFile())
    expect(backend.workspacesProjection()).toEqual([])
  })

  it('logout 触发 bot.logout 并复位状态', async () => {
    const { ctx } = makeContext()
    const backend = new WechatBackend(ctx, makeConfig(), tempStateFile())
    await backend.start()
    fakeBot.handlers.get('login')?.({ name: () => 'u', id: 'wxid' } as never)
    expect(backend.qrPayload().state.kind).toBe('logged-in')

    await backend.logout()
    expect(fakeBot.logout).toHaveBeenCalled()
    expect(backend.qrPayload().state.kind).toBe('none')

    await backend.dispose()
  })

  it('qrPayload 携带 settings/workspaces/puppet', async () => {
    const { ctx } = makeContext()
    const backend = new WechatBackend(ctx, makeConfig(), tempStateFile())
    backend.setWorkspaceRegistry({
      list: () => [{ id: 'w1' as never, title: 'dsh', path: '/p/dsh' }],
    })
    await backend.start()
    const payload = backend.qrPayload()
    expect(payload.puppet).toBe('@juzi/wechaty-puppet-service')
    expect(payload.settings.granularity).toBe('standard')
    expect(payload.settings.workspaceScope).toBe('all')
    expect(payload.workspaces).toEqual([{ id: 'w1', title: 'dsh', path: '/p/dsh' }])

    await backend.dispose()
  })
})
