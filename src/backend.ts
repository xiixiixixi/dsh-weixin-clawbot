/**
 * 微信后端：桥接 wechaty 消息与 DSH agent 会话。
 *
 * - 入站：微信消息 → 策略判断 → 每个微信主体一个 Agent → `followup`
 * - 出站：订阅 `session/event`，把本插件会话的 assistant 文本发回微信
 * - 网页：暴露 `/wechat/qrcode` 状态，供 Web GUI 的扫码窗口轮询登录二维码
 *
 * @module dsh-wechat/backend
 */

import type { Context } from '@deepseek-ai/cordis'
import { installModelSelection, type Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent-default-model'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Session, SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session'
import type { Contact, Friendship, Message, Wechaty } from '@juzi/wechaty'
import QRCode from 'qrcode'

import { createWechatBot, resolvePuppetConfig, saveInboundMedia, sendToRecipient } from './bot.js'
import { resolveMediaDir, type WechatConfig } from './config.js'
import {
  HELP_TEXT,
  chunkForWechat,
  extractAssistantText,
  mediaPlaceholder,
  parseControlCommand,
  turnEndSummary,
} from './format.js'
import { decideDm, decideGroup } from './policy.js'
import {
  isWechatSession,
  sessionIdFor,
  subjectFromSessionId,
  type WechatSubject,
} from './sessions.js'

type OwnedAgent = {
  agent: Agent
  dispose: () => Promise<void>
}

/** 微信登录/扫码状态（供 Web GUI 扫码窗口展示）。 */
export type WechatQrState =
  | { kind: 'none' }
  | { kind: 'scan'; qrcode: string; status: number; png: string }
  | { kind: 'logged-in'; userId: string; userName: string }

/** `/wechat/qrcode` 路由的响应载荷。 */
export type WechatQrPayload = {
  ok: boolean
  state: WechatQrState
  /** 扫码备用链接（终端/手机浏览器打开）。 */
  url?: string
  /** 已登录用户信息。 */
  user?: { id: string; name: string }
}

export class WechatBackend {
  private bot: Wechaty | undefined
  private readonly owned = new Map<string, OwnedAgent>()
  private currentUser: Contact | undefined
  private started = false
  private readonly disposers: Array<() => void> = []
  private readonly log: (message: string) => void
  private qrState: WechatQrState = { kind: 'none' }

  constructor(
    private readonly ctx: Context,
    private readonly config: WechatConfig,
  ) {
    this.log = (message: string) => this.ctx.logger.info(message)
  }

  /** 当前二维码/登录状态（HTTP 路由读取）。 */
  qrPayload(): WechatQrPayload {
    if (this.qrState.kind === 'scan') {
      return {
        ok: true,
        state: this.qrState,
        url: `https://wechaty.js.org/qrcode/${encodeURIComponent(this.qrState.qrcode)}`,
      }
    }
    if (this.qrState.kind === 'logged-in') {
      return {
        ok: true,
        state: this.qrState,
        user: { id: this.qrState.userId, name: this.qrState.userName },
      }
    }
    return { ok: true, state: { kind: 'none' } }
  }

  /** 异步渲染二维码 PNG（供 Web 扫码窗口内嵌显示）。 */
  private async renderQrPng(qrcode: string, status: number): Promise<void> {
    try {
      const png = await QRCode.toDataURL(qrcode, { margin: 1, width: 320 })
      // 只认最新二维码，避免过期码覆盖新码
      if (this.qrState.kind === 'scan' && this.qrState.qrcode === qrcode) {
        this.qrState = { kind: 'scan', qrcode, status, png }
      }
    } catch (error) {
      this.log(`[wechat] 二维码渲染失败: ${String(error)}`)
    }
  }

  /** 启动：订阅会话事件、解析 puppet、启动 wechaty。 */
  async start(): Promise<void> {
    if (!this.config.enabled) return
    const resolved = await resolvePuppetConfig(this.config.puppet, this.config.puppetOptions)
    const bot = createWechatBot({
      name: this.config.name,
      puppet: resolved.puppet as string,
      puppetOptions: resolved.puppetOptions,
      log: this.log,
      onScan: (qrcode, status) => {
        this.qrState = { kind: 'scan', qrcode, status, png: '' }
        void this.renderQrPng(qrcode, status)
      },
      onLogin: (user) => {
        this.currentUser = user
        this.qrState = { kind: 'logged-in', userId: user.id, userName: user.name() }
      },
      onLogout: () => {
        this.currentUser = undefined
        this.qrState = { kind: 'none' }
      },
      onMessage: (message) => this.handleMessage(message),
      onFriendship: (friendship) => this.handleFriendship(friendship),
      onError: (error) => this.log(`[wechat] ${error.message}`),
    })
    this.bot = bot

    this.disposers.push(
      this.ctx.on('session/event', (session: Session, event: SessionEvent) => {
        void this.onSessionEvent(session, event)
      }),
    )

    await bot.start()
    this.started = true
    this.log(`[wechat] 已启动（puppet: ${this.config.puppet}）`)
  }

  /** 关闭：停止 wechaty、释放全部会话与事件订阅。 */
  async dispose(): Promise<void> {
    this.started = false
    for (const disposer of this.disposers.splice(0)) disposer()
    for (const { dispose } of this.owned.values()) {
      await dispose().catch((error: unknown) =>
        this.log(`[wechat] 释放会话失败: ${String(error)}`),
      )
    }
    this.owned.clear()
    await this.bot?.stop().catch((error: unknown) =>
      this.log(`[wechat] 停止机器人失败: ${String(error)}`),
    )
    this.bot = undefined
    this.qrState = { kind: 'none' }
  }

  /** 入站微信消息 → agent。 */
  private async handleMessage(message: Message): Promise<void> {
    if (!this.started || !this.bot) return
    if (message.self()) return

    const from = message.talker()
    const room = message.room()
    const text = message.text()
    const isGroup = Boolean(room)

    let mentionSelf = false
    if (room && this.currentUser) {
      try {
        mentionSelf = message.mentionSelf()
      } catch {
        mentionSelf = false
      }
    }

    const subject: WechatSubject = isGroup
      ? { kind: 'group', id: room!.id }
      : { kind: 'direct', id: from.id }

    if (isGroup) {
      const decision = decideGroup(this.config, {
        roomId: room!.id,
        roomTopic: await room!.topic().catch(() => undefined),
        mentionSelf,
      })
      if (!decision.allowed) {
        if (decision.reason === 'no-mention') this.log(`[wechat] 忽略群消息（未 @机器人）: ${room!.id}`)
        return
      }
    } else {
      const decision = decideDm(
        this.config,
        { id: from.id, name: from.name() },
      )
      if (!decision.allowed) {
        if (decision.reason === 'pairing') {
          await sendToRecipient(this.bot, from.id, { text: this.config.pairingNotice, log: this.log })
        }
        return
      }
    }

    const command = parseControlCommand(text)
    if (command) {
      await this.handleCommand(subject, command)
      return
    }

    const mediaDir = resolveMediaDir(this.config)
    const media = await saveInboundMedia({
      message,
      mediaDir,
      maxBytes: this.config.mediaMaxMb * 1024 * 1024,
      log: this.log,
    })

    let body = text.trim()
    if (media) {
      const placeholder = mediaPlaceholder(media.kind, media.path)
      body = body ? `${body}\n${placeholder}` : placeholder
    }
    if (!body) return

    const sessionId = sessionIdFor(subject)
    const agent = await this.getOrCreateAgent(sessionId)
    agent.followup(
      createUserMessage({
        content: [{ type: 'text', text: body }],
        source: { kind: 'user' },
      }),
    )
    this.log(
      `[wechat] 入站 ${isGroup ? `群 ${room!.id}` : `用户 ${from.id}`}: ${body.slice(0, 120)}`,
    )
  }

  /** 好友请求处理：按配置自动通过。 */
  private async handleFriendship(friendship: Friendship): Promise<void> {
    if (!this.config.autoAcceptFriend) return
    // 类型 2 = 收到好友请求（wechaty-puppet FriendshipType.Receive）
    if (friendship.type() === 2) {
      await friendship.accept()
      const contact = friendship.contact()
      this.log(`[wechat] 已自动通过好友请求: ${contact.name()} (${contact.id})`)
    }
  }

  /** 会话事件 → 微信回复。 */
  private async onSessionEvent(session: Session, event: SessionEvent): Promise<void> {
    if (!this.started || !this.bot) return
    if (!isWechatSession(session.id)) return
    const subject = subjectFromSessionId(session.id)
    if (!subject) return
    const targetId = subject.id

    switch (event.type) {
      case 'assistant/message': {
        if (this.config.replyOn !== 'step') return
        const text = extractAssistantText(event.data.message)
        if (text.trim()) await this.reply(targetId, text)
        return
      }
      case 'tool/call': {
        if (this.config.noticeTools) await this.reply(targetId, `🔧 调用工具 ${event.data.name}`)
        return
      }
      case 'turn/end': {
        if (this.config.replyOn === 'turn') {
          const last = session.events.findLast((entry) => entry.type === 'assistant/message')
          if (last && last.type === 'assistant/message') {
            const text = extractAssistantText(last.data.message)
            if (text.trim()) await this.reply(targetId, text)
          }
        }
        const summary = turnEndSummary(event.data.reason)
        if (summary) await this.reply(targetId, summary)
        return
      }
      default:
        return
    }
  }

  /** 控制命令。 */
  private async handleCommand(subject: WechatSubject, command: ReturnType<typeof parseControlCommand>): Promise<void> {
    const bot = this.bot
    if (!bot) return
    const targetId = subject.id
    const sessionId = sessionIdFor(subject)
    const key = String(sessionId)
    const owned = this.owned.get(key)

    switch (command?.kind) {
      case 'new': {
        if (owned) {
          await owned.dispose().catch((error: unknown) =>
            this.log(`[wechat] 释放会话失败: ${String(error)}`),
          )
          this.owned.delete(key)
        }
        await this.reply(targetId, '已开始新会话。')
        return
      }
      case 'stop': {
        if (owned && owned.agent.status === 'running') {
          owned.agent.cancel({ kind: 'user' })
          await this.reply(targetId, '已请求停止当前任务。')
        } else {
          await this.reply(targetId, '当前没有运行中的任务。')
        }
        return
      }
      case 'status': {
        await this.reply(
          targetId,
          owned
            ? `会话: ${sessionId}\n状态: ${owned.agent.status === 'running' ? '运行中' : '空闲'}`
            : '当前没有活跃会话。',
        )
        return
      }
      case 'help': {
        await this.reply(targetId, HELP_TEXT)
        return
      }
      default:
        return
    }
  }

  /** 获取（或创建）一个微信主体专属的 agent。 */
  private async getOrCreateAgent(sessionId: SessionId): Promise<Agent> {
    const key = String(sessionId)
    const existing = this.owned.get(key)
    if (existing) return existing.agent

    const selection = this.ctx.agentDefaultModel.currentSelection()
    const { agent, dispose } = await this.ctx.agents.create({
      sessionId,
      meta: { cwd: this.config.workspace },
      agentOptions: {
        provider: selection.provider,
        model: this.config.model || selection.model,
      },
      setup: (agentCtx) => {
        installModelSelection(agentCtx, {
          current: selection,
          assembled: undefined,
        })
      },
    })
    this.owned.set(key, { agent, dispose })
    this.log(`[wechat] 已创建会话 ${sessionId}（provider=${selection.provider} model=${this.config.model || selection.model}）`)
    return agent
  }

  /** 回复微信：按配置分块发送文本。 */
  private async reply(targetId: string, text: string): Promise<void> {
    const bot = this.bot
    if (!bot) return
    await sendToRecipient(bot, targetId, {
      chunks: chunkForWechat(text, this.config.textChunkLimit),
      log: this.log,
    })
  }
}
