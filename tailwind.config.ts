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
          DEFAULT: '#2563EB',
          dark: '#1E40AF',
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
  plugins: [],
}
export default config
