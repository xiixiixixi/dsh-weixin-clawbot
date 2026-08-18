/**
 * dsh-wechat 的浏览器半部分：在侧边栏设置按钮旁注册一个微信入口，
 * 悬停显示连接状态提示，点击打开扫码窗口，轮询主机 `/wechat/qrcode`
 * 显示登录二维码与登录状态。
 *
 * @module dsh-wechat/client
 */

import { useEffect, useState, type CSSProperties, type JSX } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
// 引入 ui-sidebar 的 SlotMap 声明合并与 footer action owner props 类型。
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { SidebarFooterActionOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { WechatQrPayload } from '../backend.js'
import { Modal, Button } from '@deepseek-ai/dsh-client-ui-primitives'

/** Services required by the client plugin. */
export const inject = ['slots']

/** 扫码窗口轮询载荷（与主机 WechatQrPayload 一致）。 */
type QrPayload = WechatQrPayload

const buttonStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--dsw-alias-label-secondary, #666)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  fontSize: 14,
  width: 36,
  height: 36,
  borderRadius: 10,
}

const tooltipStyle: CSSProperties = {
  position: 'absolute',
  bottom: 'calc(100% + 8px)',
  left: '50%',
  transform: 'translateX(-50%)',
  background: '#1f2937',
  color: 'white',
  borderRadius: 8,
  padding: '6px 10px',
  fontSize: 12,
  whiteSpace: 'nowrap',
  boxShadow: '0 4px 12px rgba(0,0,0,.15)',
  zIndex: 1100,
}

/** 依据轮询状态给出一行简短的连接状态描述（用于入口 tooltip）。 */
function statusLine(payload: QrPayload | null, error: string | null): string {
  if (error !== null) return '连接中断'
  if (payload === null) return '等待微信后端启动…'
  switch (payload.state.kind) {
    case 'none':
      return '等待手机连接'
    case 'scan':
      return '等待扫码登录'
    case 'logged-in':
      return '已连接'
  }
}

function QrModal(props: {
  open: boolean
  onClose: () => void
  payload: QrPayload | null
  error: string | null
}): JSX.Element {
  let dotColor: string
  let statusText: string
  if (props.error !== null) {
    dotColor = '#e5484d'
    statusText = `连接中断：${props.error}`
  } else if (props.payload === null) {
    dotColor = '#d1d5db'
    statusText = '等待微信后端启动…'
  } else if (props.payload.state.kind === 'none') {
    dotColor = '#d1d5db'
    statusText = '等待手机连接'
  } else if (props.payload.state.kind === 'scan') {
    dotColor = '#f97316'
    statusText = `等待扫码登录（状态 ${props.payload.state.status}）`
  } else {
    dotColor = '#30a46c'
    statusText = `已连接：${props.payload.user?.name ?? props.payload.state.userName}`
  }

  const url = props.payload?.url
  const footer = url ? (
    <Button
      variant="outline"
      onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
    >
      在浏览器打开二维码
    </Button>
  ) : undefined

  return (
    <Modal open={props.open} onClose={props.onClose} title="微信" footer={footer}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          color: '#666',
          marginBottom: 12,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor }} />
        <span>{statusText}</span>
      </div>

      {props.error === null && props.payload !== null && props.payload.state.kind === 'scan' && (
        <>
          {props.payload.state.png ? (
            <img
              src={props.payload.state.png}
              alt="微信登录二维码"
              style={{ width: 260, height: 260, borderRadius: 8, border: '1px solid #eee' }}
            />
          ) : (
            <div style={{ width: 260, height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 13 }}>
              二维码生成中…
            </div>
          )}
          <div style={{ fontSize: 12, color: '#888' }}>扫码后自动保存凭据。</div>
        </>
      )}

      {props.error === null && props.payload !== null && props.payload.state.kind === 'logged-in' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 34 }}>✅</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>已登录：{props.payload.user?.name ?? props.payload.state.userName}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{props.payload.state.userId}</div>
          <div style={{ fontSize: 12, color: '#666' }}>
            现在可以直接在微信里给机器人发消息了
          </div>
        </div>
      )}
    </Modal>
  )
}

/** 侧边栏 footer 的微信入口：rail 显示图标，wide 显示图标 + 文字。 */
function WechatFooterAction(props: SidebarFooterActionOwnerProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const [payload, setPayload] = useState<QrPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const poll = async () => {
      try {
        const response = await fetch('/wechat/qrcode', { cache: 'no-store' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = (await response.json()) as QrPayload
        if (alive) {
          setPayload(data)
          setError(null)
        }
      } catch (err) {
        if (alive) setError(String(err))
      }
    }
    void poll()
    const timer = setInterval(() => void poll(), open ? 2000 : 10000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [open])

  return (
    <>
      <div
        style={{ position: 'relative', display: 'inline-flex' }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <button
          style={buttonStyle}
          title="微信"
          onClick={() => setOpen(true)}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = 'var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,0.05))'
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = 'transparent'
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            style={{ color: '#f97316' }}
          >
            <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
            <line x1="11" y1="18" x2="13" y2="18" />
          </svg>
          {props.wide && <span>微信</span>}
        </button>
        {hover && (
          <div style={tooltipStyle}>
            <div style={{ fontWeight: 700 }}>移动端远程控制</div>
            <div style={{ color: '#d1d5db' }}>{statusLine(payload, error)}</div>
          </div>
        )}
      </div>
      <QrModal open={open} onClose={() => setOpen(false)} payload={payload} error={error} />
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
