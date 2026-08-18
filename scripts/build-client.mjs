/**
 * 构建浏览器半部分：把 src/client/index.tsx 打包成 DSH 模块加载器格式
 * （window.__ModuleLoader__.load），输出 lib/client.js。
 */
import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'

const external = [
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-sidebar',
  '@deepseek-ai/dsh-client-ui-primitives',
]

mkdirSync('lib', { recursive: true })

await build({
  entryPoints: ['src/client/index.tsx'],
  bundle: true,
  outfile: 'lib/client.js',
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  minify: false,
  loader: { '.css': 'text' },
  external,
  banner: {
    js: 'window.__ModuleLoader__.load({ id: "dsh-wechat", factory: function (require) { var module = { exports: {} }; var exports = module.exports; Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
  },
  footer: {
    js: 'return module.exports; } });',
  },
  logLevel: 'info',
})

console.log('built lib/client.js')
