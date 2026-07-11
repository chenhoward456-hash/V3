import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: [
    'grid-cols-1', 'grid-cols-2', 'md:grid-cols-3', 'md:grid-cols-4',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          // 品牌主色 = 臨床海軍藍（2026-07-11 Howard 拍板，取代 Tailwind 預設藍）
          DEFAULT: '#1E4A73',
          dark: '#16385A',
          foreground: '#ffffff',
          50: '#F0F5FA',
          100: '#DEE9F3',
          200: '#BDD3E7',
          300: '#93B5D5',
          400: '#6493BE',
          500: '#3D6E9E',
          600: '#1E4A73',
          700: '#16385A',
          800: '#102A45',
          900: '#0B1E33',
        },
        secondary: '#F59E0B',
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        navy: '#1e3a5f',
        bg: {
          primary: '#FEFDFB',
          secondary: '#F9F7F4',
          tertiary: '#F3F1ED',
        },
        text: {
          primary: '#2D3748',
          secondary: '#4A5568',
          muted: '#718096',
        },
        border: {
          DEFAULT: '#E8E5E0',
          subtle: '#F3F1ED',
        },
        // shadcn/ui 語意色 — 全部對到現有 DESIGN token（品牌藍/暖灰/中性），
        // additive：不覆蓋上面任何既有 key，只補 shadcn 元件會用到的名稱。
        background: '#FEFDFB',
        foreground: '#2D3748',
        input: '#E8E5E0',
        ring: '#1E4A73',
        'secondary-foreground': '#ffffff',
        muted: { DEFAULT: '#F3F1ED', foreground: '#718096' },
        accent: { DEFAULT: '#F9F7F4', foreground: '#2D3748' },
        destructive: { DEFAULT: '#EF4444', foreground: '#ffffff' },
        card: { DEFAULT: '#ffffff', foreground: '#2D3748' },
        popover: { DEFAULT: '#ffffff', foreground: '#2D3748' },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Noto Sans TC',
          'sans-serif'
        ],
      },
      lineHeight: {
        'relaxed': '1.8',
        'loose': '2',
      },
      keyframes: {
        'slide-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'check-pop': {
          '0%': { transform: 'scale(0)' },
          '50%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'ping-once': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.3)' },
          '100%': { transform: 'scale(1)' },
        },
        'celebrate': {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(100%) translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateX(0) translateY(0)' },
        },
        'slide-out-right': {
          '0%': { opacity: '1', transform: 'translateX(0) translateY(0)' },
          '100%': { opacity: '0', transform: 'translateX(100%) translateY(8px)' },
        },
      },
      animation: {
        'slide-in-down': 'slide-in-down 0.3s ease-out',
        'check-pop': 'check-pop 0.3s ease-out',
        'fade-in-up': 'fade-in-up 0.5s ease-out',
        'ping-once': 'ping-once 0.5s ease-out',
        'celebrate': 'celebrate 0.5s ease-out',
        'slide-in-right': 'slide-in-right 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-out-right': 'slide-out-right 0.3s ease-in forwards',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config
