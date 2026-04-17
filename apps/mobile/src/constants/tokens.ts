/**
 * AttendenX Mobile — iOS 26 Design Tokens
 * Single source of truth untuk warna, radius, dan border.
 * Semua screen HARUS menggunakan nilai dari sini.
 */

// ── iOS System Colors ─────────────────────────────────────────────────────────
export const C = {
  // Accent
  blue:   '#007AFF',
  green:  '#34C759',
  red:    '#FF3B30',
  orange: '#FF9500',
  yellow: '#FFCC00',
  purple: '#AF52DE',
  teal:   '#32ADE6',
  indigo: '#5856D6',
  pink:   '#FF2D55',
  cyan:   '#5AC8FA',

  // System Backgrounds (iOS HIG)
  bgLight:    '#F2F2F7',
  bgDark:     '#000000',

  // Grouped Backgrounds
  bgGroupedLight: '#F2F2F7',
  bgGroupedDark:  '#000000',

  // Cards / Surfaces
  cardLight:  '#FFFFFF',
  cardDark:   '#1C1C1E',
  card2Light: '#F2F2F7',
  card2Dark:  '#2C2C2E',

  // Labels (iOS HIG exact)
  labelPrimary:   { light: '#000000',                   dark: '#FFFFFF'                   },
  labelSecondary: { light: 'rgba(60,60,67,0.60)',        dark: 'rgba(235,235,245,0.60)'    },
  labelTertiary:  { light: 'rgba(60,60,67,0.30)',        dark: 'rgba(235,235,245,0.30)'    },
  labelQuaternary:{ light: 'rgba(60,60,67,0.18)',        dark: 'rgba(235,235,245,0.18)'    },

  // Separators
  separator:      { light: 'rgba(60,60,67,0.29)',        dark: 'rgba(84,84,88,0.65)'       },
  separatorOpaque:{ light: '#C6C6C8',                   dark: '#38383A'                   },
} as const;

// ── Border Radius ─────────────────────────────────────────────────────────────
export const R = {
  xs:     8,    // badges, tiny chips
  sm:     12,   // icon containers, input fields
  md:     16,   // small content cards
  lg:     20,   // standard content cards
  xl:     24,   // hero / large cards
  sheet:  32,   // bottom sheets, modals
  pill:   999,  // fully rounded pills
} as const;

// ── Border ────────────────────────────────────────────────────────────────────
export const B = {
  glass:   0.5,  // glass chrome elements (toolbar, tab bar)
  default: 1,    // content cards
} as const;

// ── Typography Scale ──────────────────────────────────────────────────────────
export const T = {
  largeTitle:  { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.5 },
  title1:      { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.8 },
  title2:      { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.5 },
  title3:      { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.3 },
  headline:    { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.2 },
  body:        { fontSize: 17, fontWeight: '400' as const, letterSpacing: 0    },
  callout:     { fontSize: 16, fontWeight: '400' as const, letterSpacing: 0    },
  subhead:     { fontSize: 15, fontWeight: '400' as const, letterSpacing: 0    },
  footnote:    { fontSize: 13, fontWeight: '400' as const, letterSpacing: 0    },
  caption1:    { fontSize: 12, fontWeight: '400' as const, letterSpacing: 0    },
  caption2:    { fontSize: 11, fontWeight: '400' as const, letterSpacing: 0.06 },
  // Uppercase label (dipakai di section headers)
  sectionLabel:{ fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.0, textTransform: 'uppercase' as const },
} as const;

// ── Shadow Presets ────────────────────────────────────────────────────────────
export const S = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardDark: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  button: {
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.30,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

// ── Gradient Presets ──────────────────────────────────────────────────────────
// Hero backgrounds tertentu sengaja art-directed — definisikan di sini agar
// tidak ada hex literal tersebar di halaman. Light pairs hanya untuk halaman
// yang menampilkan gradient di mode terang (pekerjaan, business-trips).
export const gradients = {
  /** Pekerjaan — teal/green work hero */
  heroWorkDark:  ['#1A2A1A', '#0F1F0F', '#1A1A0A'] as const,
  heroWorkLight: ['#064E3B', '#065F46', '#047857'] as const,

  /** Business trips — blue→teal→olive */
  heroTripDark:  ['#0C2340', '#0A3D2E', '#1A1A0A'] as const,
  heroTripLight: ['#1D4ED8', '#0D9488', '#065F46'] as const,

  /** Leave — blue dark hero */
  heroLeave:    ['#0D1A28', '#0A0A0F'] as const,

  /** Schedule swap — orange dark hero */
  heroSwap:     ['#1A0D0A', '#0A0A0F'] as const,

  /** Visits active — deep blue hero */
  heroVisit:    ['#0A1628', '#0D1F3C', '#000'] as const,

  /** Task detail — blue+green mix */
  heroTask:     ['#0D1428', '#0A1F0A', '#0A0A0F'] as const,

  /** Expense claims — purple hero (2 variants) */
  heroExpense:     ['#1A0D28', '#0A0A0F'] as const,
  heroExpenseFull: ['#1A0D28', '#0A0A0F', '#0D1A0A'] as const,

  /** Emergency SOS — red */
  emergency:      ['#3e0d0d', '#1f0000', '#3e1a0d'] as const,
  emergencyFade:  ['transparent', '#1f0000'] as const,
} as const;

// ── Convenience Helpers ───────────────────────────────────────────────────────

/** Card background berdasarkan isDark */
export const cardBg  = (d: boolean) => d ? C.cardDark  : C.cardLight;

/** Page background berdasarkan isDark */
export const pageBg  = (d: boolean) => d ? C.bgDark    : C.bgLight;

/** Primary label color */
export const lPrimary   = (d: boolean) => d ? C.labelPrimary.dark    : C.labelPrimary.light;

/** Secondary label color */
export const lSecondary = (d: boolean) => d ? C.labelSecondary.dark  : C.labelSecondary.light;

/** Tertiary label color */
export const lTertiary  = (d: boolean) => d ? C.labelTertiary.dark   : C.labelTertiary.light;

/** Separator color */
export const separator  = (d: boolean) => d ? C.separator.dark       : C.separator.light;
