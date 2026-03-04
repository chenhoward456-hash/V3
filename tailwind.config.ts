import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
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
      },
      animation: {
        'slide-in-down': 'slide-in-down 0.3s ease-out',
        'check-pop': 'check-pop 0.3s ease-out',
      },
    },
  },
  plugins: [],
}
export default config
