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
