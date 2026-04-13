import type { Config } from 'tailwindcss';
import animatePlugin from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── iOS 26 System Colors ──────────────────────────────
        'ios-blue':   '#007AFF',
        'ios-green':  '#34C759',
        'ios-orange': '#FF9F0A',
        'ios-red':    '#FF453A',
        'ios-purple': '#BF5AF2',
        'ios-teal':   '#5AC8FA',
        'ios-indigo': '#5E5CE6',
        'ios-yellow': '#FFD60A',

        // ── Light Mode Backgrounds ─────────────────────────────
        'light-bg':       '#F2F2F7',
        'light-card':     '#FFFFFF',
        'light-grouped':  '#F2F2F7',

        // ── Light Text ─────────────────────────────────────────
        'light-text-primary':   '#111111',
        'light-text-secondary': '#6B7280',
        'light-text-tertiary':  '#9CA3AF',
        'light-text-hint':      '#D1D5DB',
        'light-text-link':      '#007AFF',

        // ── Dark Text ──────────────────────────────────────────
        'dark-text-primary':    '#FFFFFF',
        'dark-text-secondary':  'rgba(255,255,255,0.65)',
        'dark-text-link':       '#93C5FD',
      },
      borderRadius: {
        'sm':   '8px',
        'md':   '12px',
        'lg':   '14px',
        'xl':   '16px',
        '2xl':  '20px',
        'pill': '26px',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['SF Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        'page-title': ['24px', { fontWeight: '700', lineHeight: '1.2' }],
        'section':    ['18px', { fontWeight: '600', lineHeight: '1.3' }],
        'body':       ['14px', { fontWeight: '400', lineHeight: '1.6' }],
        'caption':    ['12px', { fontWeight: '400', lineHeight: '1.4' }],
        'label':      ['11px', { fontWeight: '600', letterSpacing: '0.4px' }],
      },
      backdropBlur: {
        'glass':     '28px',
        'glass-nav': '30px',
        'glass-btn': '12px',
      },
      backgroundImage: {
        // Dark mode wallpapers
        'dark-home':      'linear-gradient(145deg,#1a3a6b,#0d4f8a,#1a6b4a,#2d1b6b)',
        'dark-login':     'linear-gradient(160deg,#0d1b3e,#1a0d3e,#0d3e2d)',
        'dark-jadwal':    'linear-gradient(135deg,#1b3a5c,#0d3e1a,#3e1b0d)',
        'dark-tugas':     'linear-gradient(150deg,#2d0d3e,#0d2d4f,#1a3e0d)',
        'dark-kunjungan': 'linear-gradient(140deg,#0d3e3e,#1a0d4f,#3e2d0d)',
        'dark-absensi':   'linear-gradient(155deg,#0d1f3e,#1a3e1a,#3e0d1f)',
        'dark-profil':    'linear-gradient(145deg,#1f0d3e,#0d3e2d,#3e1f0d)',
        'dark-sos':       'linear-gradient(160deg,#3e0d0d,#1f0000,#3e1a0d)',
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'glass-shimmer': 'glassShimmer 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        glassShimmer: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
    },
  },
  plugins: [animatePlugin],
};

export default config;
