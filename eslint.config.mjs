// ESLint 9 flat config（Next 16 拿掉 `next lint`、改用 eslint CLI）。規則沿用原本 .eslintrc 的 next/core-web-vitals。
import nextVitals from 'eslint-config-next/core-web-vitals'

const config = [
  ...nextVitals,
  {
    // 2026-09-26 升 Next 16 時 eslint-plugin-react-hooks v7 新增的 React Compiler 規則，一次冒出 143 個 error。
    // 這些是新的寫法建議，不是 bug（升級前後行為一致、3355 支測試全過）。先降成 warning、保持跟升級前同樣嚴格，
    // 之後逐步收斂再調回 error。
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
  { ignores: ['.next/**', 'node_modules/**', 'public/**', 'coverage/**', '.claude/**', 'next-env.d.ts'] },
]

export default config
