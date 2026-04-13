/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
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

        // ── Background ────────────────────────────────────────
        'light-bg':   '#F2F2F7',
        'light-card': '#FFFFFF',
        'dark-card':  'rgba(255,255,255,0.10)',

        // ── Text ──────────────────────────────────────────────
        'text-primary-light':   '#111111',
        'text-secondary-light': '#6B7280',
        'text-primary-dark':    '#FFFFFF',
        'text-secondary-dark':  'rgba(255,255,255,0.65)',
      },
      borderRadius: {
        'sm':   8,
        'md':   12,
        'lg':   14,
        'xl':   16,
        '2xl':  20,
        'pill': 26,
      },
      fontFamily: {
        sans: ['Inter', 'System'],
      },
    },
  },
  plugins: [],
};
