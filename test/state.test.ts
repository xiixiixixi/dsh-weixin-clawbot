import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
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
