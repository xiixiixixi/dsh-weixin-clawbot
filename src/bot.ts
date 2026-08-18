/**
 * Wechaty 接入层：实例创建、二维码登录、媒体收发。
 *
 * @module dsh-wechat/bot
 */

import { FileBox } from '@juzi/file-box'
import type {
  Contact,
  Friendship,
  Message,
  Room,
  Wechaty,
} from '@juzi/wechaty'
import { WechatyBuilder, types } from '@juzi/wechaty'
import fs from 'node:fs'
import path from 'node:path'

export type WechatBotOptions = {
  name: string
  puppet: string
  puppetOptions: Record<string, unknown>
  log: (message: string) => void
  onScan?: (qrcode: string, status: number) => void
  onLogin?: (user: Contact) => void
  onLogout?: (user: Contact) => void
  onMessage?: (message: Message) => Promise<void> | void
  onFriendship?: (friendship: Friendship) => Promise<void> | void
  onError?: (error: Error) => void
}

/** 需要「直接实例化类」接入的 puppet 包，以及各自的导出名候选。 */
const PUPPET_CLASS_CANDIDATES: Record<string, string[]> = {
  'wechaty-puppet-wechat': ['PuppetWechat', 'default'],
  'wechaty-puppet-wechat4u': ['PuppetWechat4u', 'default'],
  'wechaty-puppet-official-account': ['PuppetOfficialAccount', 'default'],
  'wechaty-puppet-wcferry': ['PuppetWCFerry', 'PuppetWcferry', 'default'],
}

/** 把 puppet 名解析成 WechatyBuilder.build 可用的 puppet 参数。 */
export async function resolvePuppetConfig(
  puppet: string,
  puppetOptions: Record<string, unknown>,
): Promise<{ puppet: unknown; puppetOptions: Record<string, unknown> }> {
  if (puppet === '@juzi/wechaty-puppet-service') {
    return {
      puppet,
      puppetOptions: {
        authority: 'token-service-discovery-test.juzibot.com',
        tls: { disable: true },
        ...puppetOptions,
      },
    }
  }

  const candidates = PUPPET_CLASS_CANDIDATES[puppet]
  if (!candidates) return { puppet, puppetOptions }

  let mod: unknown
  try {
    mod = await import(/* webpackIgnore: true */ puppet)
  } catch (error) {
    throw new Error(
      `微信接入包未安装：${puppet}。请先 npm i ${puppet}。原始错误：${String(error)}`,
    )
  }

  const moduleRecord = mod as Record<string, unknown>
  for (const name of candidates) {
    const cls =
      moduleRecord[name] ??
      (moduleRecord.default as Record<string, unknown> | undefined)?.[name]
    if (typeof cls === 'function') {
      return {
        puppet: new (cls as new (opts?: unknown) => unknown)(puppetOptions),
        puppetOptions,
      }
    }
  }
  throw new Error(`在 ${puppet} 中找不到可用的 puppet 类导出（尝试了：${candidates.join(', ')}）`)
}

/** 创建 wechaty 实例并绑定标准事件。 */
export function createWechatBot(opts: WechatBotOptions): Wechaty {
  const bot = WechatyBuilder.build({
    name: opts.name,
    puppet: opts.puppet as never,
    ...(Object.keys(opts.puppetOptions).length ? { puppetOptions: opts.puppetOptions } : {}),
  })

  bot.on('scan', async (qrcode, status) => {
    opts.log(`微信登录二维码已生成（状态 ${status}），请在 Web 界面点击微信图标扫码登录`)
    opts.onScan?.(qrcode, status)
  })

  bot.on('login', async (user) => {
    opts.log(`✔ 微信登录成功：${user.name()} (${user.id})`)
    opts.onLogin?.(user)
  })

  bot.on('logout', async (user) => {
    opts.log(`✗ 微信登出：${user.name()} (${user.id})`)
    opts.onLogout?.(user)
  })

  bot.on('message', async (message) => {
    try {
      await opts.onMessage?.(message)
    } catch (error) {
      opts.log(`处理 message 事件失败: ${String(error)}`)
    }
  })

  bot.on('friendship', async (friendship) => {
    try {
      await opts.onFriendship?.(friendship)
    } catch (error) {
      opts.log(`处理 friendship 事件失败: ${String(error)}`)
    }
  })

  bot.on('error', async (error) => {
    opts.log(`微信机器人错误: ${error.message}`)
    opts.onError?.(error)
  })

  return bot
}

/** 微信消息类型 → 媒体种类（file-box 可下载的类型）。 */
export function mediaKindOf(type: number): 'image' | 'voice' | 'video' | 'file' | undefined {
  switch (type) {
    case types.Message.Image:
      return 'image'
    case types.Message.Audio:
      return 'voice'
    case types.Message.Video:
      return 'video'
    case types.Message.Attachment:
      return 'file'
    default:
      return undefined
  }
}

/** 下载入站媒体到 mediaDir，返回落盘路径。 */
export async function saveInboundMedia(params: {
  message: Message
  mediaDir: string
  maxBytes: number
  log: (message: string) => void
}): Promise<{ kind: 'image' | 'voice' | 'video' | 'file'; path: string } | undefined> {
  const { message, mediaDir, maxBytes, log } = params
  const kind = mediaKindOf(message.type())
  if (!kind) return undefined

  try {
    const fileBox = await message.toFileBox()
    if (!fileBox) return undefined
    const buffer = await fileBox.toBuffer()
    if (buffer.length > maxBytes) {
      log(`[wechat] 入站媒体超过上限 ${maxBytes} 字节，已忽略`)
      return undefined
    }
    fs.mkdirSync(mediaDir, { recursive: true })
    const name = fileBox.name || `media-${Date.now()}`
    const target = path.join(mediaDir, `${Date.now()}-${name}`)
    fs.writeFileSync(target, buffer)
    return { kind, path: target }
  } catch (error) {
    log(`[wechat] 下载入站媒体失败: ${String(error)}`)
    return undefined
  }
}

/** 出站媒体：本地路径 / URL / buffer → FileBox。 */
export async function prepareOutboundMedia(params: {
  mediaUrl?: string
  fileName?: string
}): Promise<FileBox | undefined> {
  const { mediaUrl, fileName } = params
  if (!mediaUrl) return undefined

  try {
    let buffer: Buffer
    let name: string
    if (/^https?:\/\//.test(mediaUrl)) {
      const response = await fetch(mediaUrl)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      buffer = Buffer.from(await response.arrayBuffer())
      name = fileName ?? path.basename(new URL(mediaUrl).pathname) ?? `file-${Date.now()}`
    } else {
      const filePath = mediaUrl.replace(/^file:\/\//, '').replace(/^~\//, `${process.env.HOME ?? ''}/`)
      if (!fs.existsSync(filePath)) throw new Error(`本地文件不存在: ${filePath}`)
      buffer = fs.readFileSync(filePath)
      name = fileName ?? path.basename(filePath)
    }
    return FileBox.fromBuffer(buffer, name)
  } catch (error) {
    console.error(`[wechat] 准备出站媒体失败: ${String(error)}`)
    return undefined
  }
}

/** 发送文本（按需分块）与可选媒体到联系人或群。 */
export async function sendToRecipient(
  bot: Wechaty,
  targetId: string,
  opts: {
    text?: string
    chunks?: string[]
    mediaUrl?: string
    log: (message: string) => void
  },
): Promise<void> {
  const recipient =
    (await bot.Contact.find({ id: targetId }).catch(() => undefined)) ??
    (await bot.Contact.find({ name: targetId }).catch(() => undefined)) ??
    (await bot.Room.find({ id: targetId }).catch(() => undefined)) ??
    (await bot.Room.find({ topic: targetId }).catch(() => undefined))
  if (!recipient) {
    opts.log(`[wechat] 找不到收件人: ${targetId}`)
    return
  }

  const chunks = opts.chunks ?? (opts.text ? [opts.text] : [])
  for (const chunk of chunks) {
    if (chunk.trim()) await recipient.say(chunk)
  }
  if (opts.mediaUrl) {
    const fileBox = await prepareOutboundMedia({ mediaUrl: opts.mediaUrl })
    if (fileBox) await recipient.say(fileBox)
  }
}
