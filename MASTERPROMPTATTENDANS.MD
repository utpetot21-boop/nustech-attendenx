# NUSTECH-ATTENDENX — MASTER PROJECT PROMPT
> Nama Resmi   : Nustech-AttendenX
> Dikembangkan : Nustech
> Versi Prompt : 2.0 (Restructured — Final)
> Timezone     : WITA (UTC+8, Asia/Makassar)
> Infrastruktur: VPS KVM 2 — 76.13.23.42 (Docker + Traefik sudah terpasang)
>
> CARA PAKAI: Paste seluruh prompt ini ke Claude Sonnet di VS Code sebagai
> pesan pertama. Agent akan memahami seluruh konteks dan mulai dari Fase 0.
> Setiap fase selesai → agent konfirmasi → lanjut fase berikutnya.

---
## 1. IDENTITAS PROYEK

**Nama aplikasi:** Nustech-AttendenX  
**Tujuan:** Sistem absensi, monitoring kunjungan lapangan, dispatch tugas, dan manajemen cuti untuk perusahaan/kantor dengan karyawan kantor dan lapangan (teknisi/sales).  
**Platform:** Mobile app (Android & iOS) + Web app dashboard  
**Tema desain:** iOS 26 Liquid Glass — Dual Mode (Light: Hybrid Opsi B | Dark: Full Glass Opsi A), bento grid, tipografi Inter  

---


---

## 2. DESIGN SYSTEM — iOS 26 Liquid Glass

> Sistem desain ini mengikuti filosofi iOS 26 Liquid Glass resmi Apple (WWDC 2025).
> DUA mode wajib diimplementasikan: Light Mode (Opsi B) dan Dark Mode (Opsi A).
> Mode mengikuti preferensi sistem HP karyawan secara otomatis.

---

### 2.1 Filosofi iOS 26 Liquid Glass

```
PRINSIP UTAMA:
1. KONTEN adalah raja — konten utama (list, card, tabel) menggunakan
   material solid yang mudah dibaca, tidak pakai glass effect
2. NAVIGASI mengambang — tab bar dan toolbar menggunakan Liquid Glass
   yang mengambang di atas konten, tidak pinned ke bezel
3. TOMBOL AKSI menggunakan glass material dengan specular highlight
4. DUA LAYER: layer konten (bawah, solid) + layer navigasi (atas, glass)

LIQUID GLASS MATERIAL:
- backdrop-filter: blur(28px) saturate(200%)
- box-shadow: inset 0 1px 0 rgba(255,255,255,X)  ← specular highlight atas
- Warna glass menyesuaikan mode (light/dark) secara otomatis
- Tidak boleh dipakai untuk: list items, tabel, konten scroll

ELEMEN YANG WAJIB PAKAI LIQUID GLASS:
✓ Tab bar bawah (mengambang, border-radius: 26px)
✓ Toolbar atas (pill mengambang, border-radius: 16px)
✓ Tombol aksi utama (FAB — Floating Action Button)
✓ Modal / bottom sheet overlay
✓ Floating badge notifikasi

ELEMEN YANG TIDAK BOLEH PAKAI GLASS:
✗ Card konten (list tugas, data absensi, dll)
✗ Background screen
✗ Tabel dan form input area
✗ Status card (hadir, alfa, dll)
```

---

### 2.2 Palet Warna — Dual Mode

```
/* ═══ WARNA SISTEM (sama di light dan dark) ═══ */
--color-blue:    #007AFF   /* tombol utama, aktif, highlight */
--color-green:   #34C759   /* sukses, hadir, selesai */
--color-orange:  #FF9F0A   /* peringatan, pending, mendadak */
--color-red:     #FF453A   /* error, alert, alfa, bahaya, SOS */
--color-purple:  #BF5AF2   /* piket, on-call, delegasi */
--color-teal:    #5AC8FA   /* info, kunjungan, BA */
--color-indigo:  #5E5CE6   /* jadwal, shift */
--color-yellow:  #FFD60A   /* countdown, waktu kritis */

/* ═══════════════════════════════════════════════════ */
/* LIGHT MODE — Opsi B (default, untuk kerja lapangan)*/
/* ═══════════════════════════════════════════════════ */

/* Background */
--light-bg-screen:    #F2F2F7   /* background utama semua screen */
--light-bg-card:      #FFFFFF   /* card konten */
--light-bg-grouped:   #F2F2F7   /* grouped list background */

/* Tinted Cards (konten — bukan glass) */
--light-card-blue:    background:#EFF6FF; border:0.5px solid #BFDBFE
--light-card-green:   background:#F0FDF4; border:0.5px solid #BBF7D0
--light-card-orange:  background:#FFF7ED; border:0.5px solid #FED7AA
--light-card-red:     background:#FEF2F2; border:0.5px solid #FECACA
--light-card-purple:  background:#F5F3FF; border:0.5px solid #DDD6FE
--light-card-teal:    background:#ECFEFF; border:0.5px solid #A5F3FC
--light-card-yellow:  background:#FEFCE8; border:0.5px solid #FDE68A

/* Liquid Glass — Navigasi & Tombol (light) */
--light-glass-nav:    background:rgba(242,242,247,0.78)
                      border:0.5px solid rgba(255,255,255,0.92)
                      backdrop-filter:blur(28px) saturate(200%)
                      box-shadow: inset 0 1px 0 rgba(255,255,255,0.95),
                                  inset 0 -0.5px 0 rgba(0,0,0,0.06),
                                  0 4px 20px rgba(0,0,0,0.10)

--light-glass-btn:    background:rgba(0,122,255,0.90)
                      border:0.5px solid rgba(0,122,255,0.6)
                      backdrop-filter:blur(12px)
                      box-shadow: inset 0 1px 0 rgba(255,255,255,0.35),
                                  0 2px 10px rgba(0,122,255,0.25)

--light-glass-toolbar:background:rgba(242,242,247,0.82)
                      border:0.5px solid rgba(255,255,255,0.95)
                      backdrop-filter:blur(20px) saturate(180%)
                      box-shadow: inset 0 1px 0 rgba(255,255,255,0.9),
                                  0 2px 8px rgba(0,0,0,0.07)

/* Teks (light) */
--light-text-primary:   #111111
--light-text-secondary: #6B7280
--light-text-tertiary:  #9CA3AF
--light-text-hint:      #D1D5DB
--light-text-link:      #007AFF

/* Border (light) */
--light-border-card:    0.5px solid rgba(0,0,0,0.07)
--light-border-section: 0.5px solid #E5E7EB

/* ═══════════════════════════════════════════════════ */
/* DARK MODE — Opsi A (malam, kondisi gelap)          */
/* ═══════════════════════════════════════════════════ */

/* Background wallpaper per screen (gradient unik) */
--dark-bg-home:       linear-gradient(145deg,#1a3a6b,#0d4f8a,#1a6b4a,#2d1b6b)
--dark-bg-login:      linear-gradient(160deg,#0d1b3e,#1a0d3e,#0d3e2d)
--dark-bg-jadwal:     linear-gradient(135deg,#1b3a5c,#0d3e1a,#3e1b0d)
--dark-bg-tugas:      linear-gradient(150deg,#2d0d3e,#0d2d4f,#1a3e0d)
--dark-bg-kunjungan:  linear-gradient(140deg,#0d3e3e,#1a0d4f,#3e2d0d)
--dark-bg-absensi:    linear-gradient(155deg,#0d1f3e,#1a3e1a,#3e0d1f)
--dark-bg-profil:     linear-gradient(145deg,#1f0d3e,#0d3e2d,#3e1f0d)
--dark-bg-klaim:      linear-gradient(135deg,#0d2d3e,#2d0d3e,#0d3e1a)
--dark-bg-sos:        linear-gradient(160deg,#3e0d0d,#1f0000,#3e1a0d)
--dark-bg-notif:      linear-gradient(140deg,#0d1a3e,#2d0d2d,#0d3e1a)

/* Liquid Glass Cards (dark — semua pakai glass karena wallpaper tembus) */
--dark-glass-card:    background:rgba(255,255,255,0.10)
                      border:0.5px solid rgba(255,255,255,0.18)
                      backdrop-filter:blur(20px) saturate(180%)
                      box-shadow: inset 0 1px 0 rgba(255,255,255,0.20)

--dark-glass-blue:    background:rgba(0,122,255,0.20);  border:0.5px solid rgba(0,122,255,0.40)
--dark-glass-green:   background:rgba(52,199,89,0.16);  border:0.5px solid rgba(52,199,89,0.35)
--dark-glass-orange:  background:rgba(255,159,10,0.16); border:0.5px solid rgba(255,159,10,0.35)
--dark-glass-red:     background:rgba(255,69,58,0.16);  border:0.5px solid rgba(255,69,58,0.35)
--dark-glass-purple:  background:rgba(191,90,242,0.16); border:0.5px solid rgba(191,90,242,0.35)
--dark-glass-teal:    background:rgba(90,200,250,0.16); border:0.5px solid rgba(90,200,250,0.35)

/* Liquid Glass — Navigasi & Tombol (dark) */
--dark-glass-nav:     background:rgba(255,255,255,0.12)
                      border:0.5px solid rgba(255,255,255,0.22)
                      backdrop-filter:blur(30px) saturate(200%)
                      box-shadow: inset 0 1px 0 rgba(255,255,255,0.25),
                                  0 4px 16px rgba(0,0,0,0.20)

--dark-glass-btn:     background:rgba(0,122,255,0.80)
                      border:0.5px solid rgba(0,122,255,0.9)
                      backdrop-filter:blur(10px)
                      box-shadow: inset 0 1px 0 rgba(255,255,255,0.30),
                                  0 2px 8px rgba(0,122,255,0.30)

/* Teks (dark) */
--dark-text-primary:   #FFFFFF
--dark-text-secondary: rgba(255,255,255,0.65)
--dark-text-tertiary:  rgba(255,255,255,0.40)
--dark-text-hint:      rgba(255,255,255,0.20)
--dark-text-link:      #93C5FD

/* Border (dark) */
--dark-border-card:    0.5px solid rgba(255,255,255,0.12)
```

---

### 2.3 Tipografi

```
Font family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif
Font weights: 300 (light), 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

/* Mobile */
Heading 1:   28px, weight 700, letter-spacing -0.5px
Heading 2:   22px, weight 700, letter-spacing -0.4px
Heading 3:   17px, weight 600, letter-spacing -0.3px
Body:        15px, weight 400, line-height 1.5
Caption:     12px, weight 400
Label:       11px, weight 600, UPPERCASE, letter-spacing 0.4px
Mono:        'SF Mono', 'Fira Code', monospace

/* Web (lebih besar karena layar lebar) */
Page Title:  24px, weight 700
Section:     18px, weight 600
Body:        14px, weight 400, line-height 1.6
Caption:     12px, weight 400
Label:       11px, weight 600, UPPERCASE
```

---

### 2.4 Komponen UI — Spesifikasi Lengkap

```
/* ═══ BORDER RADIUS ═══ */
radius-sm:   8px   (input kecil, badge)
radius-md:   12px  (card kecil, tombol kecil)
radius-lg:   14px  (card utama)
radius-xl:   16px  (toolbar glass)
radius-2xl:  20px  (modal, bottom sheet)
radius-pill: 26px  (tab bar mengambang)
radius-full: 999px (badge, chip)

/* ═══ TAB BAR MENGAMBANG — iOS 26 Style ═══ */
LIGHT MODE:
  margin: 6px 10px 10px          ← tidak pinned ke bezel, ada margin
  border-radius: 26px             ← pill shape
  background: rgba(242,242,247,0.78)
  border: 0.5px solid rgba(255,255,255,0.92)
  backdrop-filter: blur(28px) saturate(200%)
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.95),   ← specular atas
              inset 0 -0.5px 0 rgba(0,0,0,0.06),       ← subtle bawah
              0 4px 20px rgba(0,0,0,0.10)              ← shadow mengambang
  padding: 8px 4px

DARK MODE:
  background: rgba(255,255,255,0.12)
  border: 0.5px solid rgba(255,255,255,0.22)
  backdrop-filter: blur(30px) saturate(200%)
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.25),
              0 4px 16px rgba(0,0,0,0.20)

TAB ITEM:
  Tab aktif: ikon warna --color-blue (#007AFF) + dot biru kecil bawah ikon
  Tab tidak aktif: ikon warna abu (#9CA3AF light / rgba(255,255,255,0.40) dark)
  Label: 7px, font-weight 500/700 (aktif)

TAB BAR SHRINK SAAT SCROLL:
  Saat scroll ke bawah: tab bar mengecil (hide label, hanya ikon)
  Saat scroll ke atas: tab bar expand normal kembali
  Implementasi: Animated.Value di React Native + onScroll handler

/* ═══ TOOLBAR GLASS (mengambang di atas konten) ═══ */
LIGHT MODE:
  margin: 0 10px 8px
  border-radius: 16px
  background: rgba(242,242,247,0.82)
  border: 0.5px solid rgba(255,255,255,0.95)
  backdrop-filter: blur(20px) saturate(180%)
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 8px rgba(0,0,0,0.07)
  padding: 8px 12px

DARK MODE:
  background: rgba(255,255,255,0.10)
  border: 0.5px solid rgba(255,255,255,0.20)

/* ═══ TOMBOL UTAMA — Floating Action Button (FAB) ═══ */
LIGHT MODE:
  height: 48px, border-radius: 14px
  background: rgba(0,122,255,0.90)
  border: 0.5px solid rgba(0,122,255,0.60)
  backdrop-filter: blur(12px)
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 10px rgba(0,122,255,0.25)
  font: Inter 700, 15px, color #fff

DARK MODE:
  background: rgba(0,122,255,0.80)
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.30), 0 2px 8px rgba(0,122,255,0.30)

/* ═══ CARD KONTEN (solid, bukan glass) ═══ */
LIGHT MODE:
  background: #FFFFFF
  border: 0.5px solid rgba(0,0,0,0.07)
  border-radius: 14px
  padding: 10px 12px
  box-shadow: 0 1px 4px rgba(0,0,0,0.06)

DARK MODE:
  background: rgba(255,255,255,0.10)
  border: 0.5px solid rgba(255,255,255,0.18)
  backdrop-filter: blur(20px)
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.18)

/* ═══ TOMBOL SEKUNDER ═══ */
LIGHT MODE:
  background: rgba(255,255,255,0.85)
  border: 0.5px solid rgba(0,0,0,0.10)
  backdrop-filter: blur(8px)
  box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 1px 3px rgba(0,0,0,0.05)
  color: #374151

DARK MODE:
  background: rgba(255,255,255,0.12)
  border: 0.5px solid rgba(255,255,255,0.20)
  color: rgba(255,255,255,0.80)

/* ═══ TOGGLE / SEGMENTED CONTROL ═══ */
LIGHT MODE:
  Container: background rgba(0,0,0,0.05), border-radius 10px, padding 2px
  Active: background rgba(255,255,255,0.90), box-shadow 0 1px 4px rgba(0,0,0,0.10)
  Inactive: transparent

DARK MODE:
  Container: background rgba(255,255,255,0.10)
  Active: background rgba(255,255,255,0.18), box-shadow inset 0 1px 0 rgba(255,255,255,0.25)

/* ═══ INPUT FIELD ═══ */
LIGHT MODE:
  background: rgba(255,255,255,0.85)
  border: 0.5px solid rgba(0,0,0,0.10)
  border-radius: 12px, padding: 10px 12px
  box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 1px 3px rgba(0,0,0,0.05)
  color: #374151, placeholder: #9CA3AF

DARK MODE:
  background: rgba(255,255,255,0.10)
  border: 0.5px solid rgba(255,255,255,0.18)
  color: #FFFFFF, placeholder: rgba(255,255,255,0.35)

/* ═══ PILL / BADGE / CHIP ═══ */
LIGHT MODE — tinted:
  blue:   background #DBEAFE, color #1D4ED8
  green:  background #DCFCE7, color #15803D
  orange: background #FFEDD5, color #C2410C
  red:    background #FEE2E2, color #DC2626
  gray:   background #F3F4F6, color #6B7280
  purple: background #EDE9FE, color #6D28D9

DARK MODE — glass tinted:
  blue:   background rgba(0,122,255,0.30), color #7DD3FC, border rgba(0,122,255,0.50)
  green:  background rgba(52,199,89,0.25), color #86EFAC, border rgba(52,199,89,0.45)
  orange: background rgba(255,159,10,0.25), color #FCD34D, border rgba(255,159,10,0.45)
  red:    background rgba(255,69,58,0.30), color #FCA5A5, border rgba(255,69,58,0.50)

/* ═══ DYNAMIC ISLAND ═══ */
LIGHT: background #1a1a1a, width 82px, height 20px, border-radius 10px
DARK:  background #000000, width 88px, height 22px, border-radius 11px
       box-shadow: 0 0 0 2px rgba(255,255,255,0.08)

/* ═══ BENTO GRID MOBILE ═══ */
display: grid
grid-template-columns: 1fr 1fr
gap: 8px
padding: 0 10px

/* ═══ SIDEBAR WEB ═══ */
LIGHT: width 220px, background #F9FAFB, border-right 1px solid #E5E7EB
DARK:  width 220px, background rgba(255,255,255,0.04), border-right 0.5px solid rgba(255,255,255,0.08)
```

---

### 2.5 Implementasi React Native (NativeWind + Expo)

```javascript
// tailwind.config.js — tambahkan custom colors
module.exports = {
  theme: {
    extend: {
      colors: {
        'ios-blue':   '#007AFF',
        'ios-green':  '#34C759',
        'ios-orange': '#FF9F0A',
        'ios-red':    '#FF453A',
        'ios-purple': '#BF5AF2',
        'ios-teal':   '#5AC8FA',
        'ios-yellow': '#FFD60A',
      }
    }
  }
}

// useColorScheme() — detect light/dark
import { useColorScheme } from 'react-native'
const scheme = useColorScheme() // 'light' | 'dark'

// LiquidGlassTabBar.tsx — tab bar mengambang iOS 26
// Library: expo-blur (BlurView) untuk efek backdrop-filter
import { BlurView } from 'expo-blur'

<BlurView
  intensity={scheme === 'dark' ? 80 : 85}
  tint={scheme === 'dark' ? 'dark' : 'light'}
  style={{
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: scheme === 'dark'
      ? 'rgba(255,255,255,0.22)'
      : 'rgba(255,255,255,0.92)',
  }}
>
  {/* Tab items */}
</BlurView>

// GlassToolbar.tsx — toolbar mengambang
<BlurView
  intensity={scheme === 'dark' ? 70 : 75}
  tint={scheme === 'dark' ? 'dark' : 'light'}
  style={{
    marginHorizontal: 10,
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: scheme === 'dark'
      ? 'rgba(255,255,255,0.20)'
      : 'rgba(255,255,255,0.95)',
  }}
>
  {/* Header content */}
</BlurView>

// GlassButton.tsx — FAB tombol utama
<BlurView intensity={20} tint="dark" style={{ borderRadius: 14 }}>
  <TouchableOpacity style={{
    backgroundColor: 'rgba(0,122,255,0.88)',
    padding: 14,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(0,122,255,0.60)',
  }}>
    <Text style={{ color: '#fff', fontWeight: '700' }}>{label}</Text>
  </TouchableOpacity>
</BlurView>

// PACKAGE yang dibutuhkan:
// expo install expo-blur            ← BlurView untuk glass effect
// expo install expo-linear-gradient ← wallpaper gradient (dark mode)
```

---

### 2.6 Wallpaper Dark Mode per Screen

```javascript
// Setiap screen dark mode punya wallpaper gradient unik
// Implementasi: expo-linear-gradient sebagai background absolut

import { LinearGradient } from 'expo-linear-gradient'

const WALLPAPERS = {
  home:      ['#1a3a6b', '#0d4f8a', '#1a6b4a', '#2d1b6b'],
  login:     ['#0d1b3e', '#1a0d3e', '#0d3e2d'],
  jadwal:    ['#1b3a5c', '#0d3e1a', '#3e1b0d'],
  tugas:     ['#2d0d3e', '#0d2d4f', '#1a3e0d'],
  kunjungan: ['#0d3e3e', '#1a0d4f', '#3e2d0d'],
  absensi:   ['#0d1f3e', '#1a3e1a', '#3e0d1f'],
  profil:    ['#1f0d3e', '#0d3e2d', '#3e1f0d'],
  klaim:     ['#0d2d3e', '#2d0d3e', '#0d3e1a'],
  sos:       ['#3e0d0d', '#1f0000', '#3e1a0d'],
  notif:     ['#0d1a3e', '#2d0d2d', '#0d3e1a'],
}

// Light mode: tidak pakai wallpaper, background solid #F2F2F7
// Dark mode: render LinearGradient di belakang semua konten
```

## 3. ARSITEKTUR & TEKNOLOGI

### 3.1 Stack Lengkap
```
MOBILE APP
├── Framework:        React Native + Expo SDK 51
├── Router:           Expo Router (file-based)
├── State:            Zustand + React Query (TanStack Query v5)
├── Styling:          NativeWind (Tailwind for RN) + custom StyleSheet
├── Camera:           expo-camera + expo-image-manipulator (watermark)
├── GPS:              expo-location (presisi tinggi, 6 desimal)
├── Maps:             react-native-maps (OpenStreetMap tiles)
├── Routing:          OSRM API (kalkulasi jarak & waktu)
├── Navigasi:         Deep link Google Maps / Waze
├── Offline DB:       WatermelonDB
├── Push notif:       Expo Notifications + FCM
├── TTD digital:      react-native-signature-canvas
├── QR Scanner:       expo-barcode-scanner
├── Biometrik:        expo-local-authentication (Face ID + Fingerprint lokal)
│                     -- verifikasi di device, TIDAK kirim data ke server
├── QR Scanner:       expo-barcode-scanner (alternatif jika no biometrik)
└── HTTP:             Axios

WEB APP
├── Framework:        Next.js 14 (App Router)
├── UI:               Tailwind CSS + shadcn/ui
├── State:            Zustand + TanStack Query v5
├── Maps:             Leaflet.js + React-Leaflet (OpenStreetMap tiles)
├── Routing:          OSRM API (jarak, waktu, polyline rute)
├── Navigasi:         Deep link Google Maps / Waze (buka app eksternal)
├── Realtime:         Socket.io client
├── Charts:           Recharts
├── Calendar:         FullCalendar
├── Tables:           TanStack Table v8
├── Export Excel:     SheetJS (xlsx)
├── Forms:            React Hook Form + Zod
└── HTTP:             Axios

BACKEND
├── Runtime:          Node.js 20 LTS
├── Framework:        NestJS 10 (TypeScript)
├── API:              REST + WebSocket (Socket.io)
├── ORM:              TypeORM
├── Auth:             JWT (access 15m) + Refresh Token (7d) + Passport.js
├── Validation:       class-validator + class-transformer
├── Queue/Jobs:       Bull + Redis (BullMQ)
├── Cron:             @nestjs/schedule
├── File upload:      Multer + Sharp
├── PDF:              Puppeteer + Handlebars (template)
├── Testing:          Jest + Supertest
└── Docs:             Swagger (@nestjs/swagger)

DATABASE
├── Primary DB:       PostgreSQL 16
├── Cache/Queue:      Redis 7
└── ORM:              TypeORM dengan migrations

VENDOR & EXTERNAL API
├── Geocoding:        Nominatim (OpenStreetMap) + Redis cache 30 hari
-- CATATAN: AWS Rekognition DIHAPUS dari stack.
-- Absensi Face ID menggunakan sensor biometrik HP via expo-local-authentication
-- Verifikasi terjadi di device (tidak ada data wajah yang dikirim ke server)
├── Maps Dashboard:   Leaflet.js + OpenStreetMap + OSRM
├── WhatsApp:         whatsapp-web.js (self-hosted, nomor dedikasi)
├── Push Notification:Firebase Cloud Messaging (FCM)
├── Email:            Resend.com (transactional)
├── Storage:          Cloudflare R2 (S3-compatible, egress gratis)
└── Error tracking:   Sentry

INFRASTRUCTURE
├── Server:           VPS KVM 2 (Ubuntu 24.04, 2 core CPU, 8GB RAM)
│                     IP: 76.13.23.42 — sudah running
├── Database:         PostgreSQL 16 via Docker container (di VPS yang sama)
├── Cache:            Redis 7 via Docker container (di VPS yang sama)
├── Container:        Docker + Docker Compose (sudah terpasang di VPS)
├── Reverse proxy:    Traefik (sudah terpasang di VPS) + Let's Encrypt SSL otomatis
├── Storage:          Cloudflare R2 (S3-compatible, egress gratis)
├── Error tracking:   Sentry
└── CI/CD:            GitHub Actions → SSH deploy ke VPS

CATATAN INFRASTRUKTUR:
- Docker dan Traefik sudah terpasang dan running di VPS
- Tidak perlu setup AWS EC2, RDS, atau ElastiCache
- PostgreSQL dan Redis berjalan sebagai Docker container di VPS yang sama
- Traefik otomatis handle SSL Let's Encrypt untuk semua subdomain
- Disk 100GB cukup untuk data, foto, dan PDF selama 2–3 tahun
- RAM 8GB cukup untuk semua service dengan headroom ~5.6GB
```

### 3.2 Struktur Folder Lengkap

```
nustech-attendenx/                           ← root monorepo
├── apps/
│   ├── mobile/                    ← React Native + Expo
│   │   ├── src/
│   │   │   ├── app/               ← Expo Router (file-based routing)
│   │   │   │   ├── _layout.tsx
│   │   │   │   ├── (auth)/
│   │   │   │   │   ├── _layout.tsx
│   │   │   │   │   └── login.tsx
│   │   │   │   └── (main)/
│   │   │   │       ├── _layout.tsx        ← Bottom tab navigator
│   │   │   │       ├── index.tsx          ← Beranda (bento grid)
│   │   │   │       ├── schedule.tsx       ← Jadwal (mingguan/bulanan/agenda)
│   │   │   │       ├── tasks.tsx          ← Tugas & dispatch
│   │   │   │       ├── visits/
│   │   │   │       │   ├── index.tsx      ← List kunjungan
│   │   │   │       │   └── [id].tsx       ← Detail kunjungan aktif
│   │   │   │       └── profile.tsx        ← Profil & saldo cuti
│   │   │   ├── components/
│   │   │   │   ├── ui/                    ← Komponen dasar iOS 26 Liquid Glass
│   │   │   │   │   ├── GlassCard.tsx
│   │   │   │   │   ├── BentoGrid.tsx
│   │   │   │   │   ├── Badge.tsx
│   │   │   │   │   ├── Button.tsx
│   │   │   │   │   ├── BottomNav.tsx
│   │   │   │   │   ├── DynamicIsland.tsx
│   │   │   │   │   └── StatusBar.tsx
│   │   │   │   ├── attendance/
│   │   │   │   │   ├── CheckInButton.tsx
│   │   │   │   │   ├── CheckOutButton.tsx  ← Dikunci sampai 8 jam
│   │   │   │   │   ├── CountdownTimer.tsx  ← Hitung mundur 8 jam
│   │   │   │   │   ├── BiometricAuth.tsx   ← expo-local-authentication (Face ID + Fingerprint)
│   │   │   │   │   ├── QRScanner.tsx
│   │   │   │   │   └── GPSValidator.tsx    ← Geofence checker
│   │   │   │   ├── visit/
│   │   │   │   │   ├── WatermarkCamera.tsx ← CORE: kamera + watermark
│   │   │   │   │   ├── PhotoPhaseGrid.tsx  ← Grid foto 3 fase
│   │   │   │   │   ├── SignaturePad.tsx    ← TTD digital klien
│   │   │   │   │   ├── ReportForm.tsx      ← Form laporan kunjungan
│   │   │   │   │   └── ServiceReport.tsx   ← Preview berita acara
│   │   │   │   ├── schedule/
│   │   │   │   │   ├── WeekView.tsx
│   │   │   │   │   ├── MonthCalendar.tsx
│   │   │   │   │   └── AgendaList.tsx
│   │   │   │   ├── dispatch/
│   │   │   │   │   ├── TaskCard.tsx
│   │   │   │   │   ├── ConfirmCountdown.tsx ← Timer konfirmasi tugas
│   │   │   │   │   └── DelegationCard.tsx
│   │   │   │   ├── map/
│   │   │   │   │   ├── MiniMap.tsx
│   │   │   │   │   ├── LiveTrackingMap.tsx
│   │   │   │   │   └── NavigationButton.tsx
│   │   │   │   └── notifications/
│   │   │   │       └── NotifItem.tsx
│   │   │   ├── services/
│   │   │   │   ├── api.ts                  ← Axios instance + interceptors
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── attendance.service.ts
│   │   │   │   ├── visit.service.ts
│   │   │   │   ├── task.service.ts
│   │   │   │   ├── schedule.service.ts
│   │   │   │   ├── leave.service.ts
│   │   │   │   ├── geocoding.service.ts    ← Google Maps reverse geocoding
│   │   │   │   ├── watermark.service.ts    ← Canvas watermark burn
│   │   │   │   └── notification.service.ts
│   │   │   ├── stores/                     ← Zustand stores
│   │   │   │   ├── auth.store.ts
│   │   │   │   ├── attendance.store.ts
│   │   │   │   ├── visit.store.ts
│   │   │   │   └── notification.store.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useGPS.ts               ← Koordinat 6 desimal
│   │   │   │   ├── useGeofence.ts          ← Validasi radius
│   │   │   │   ├── useBiometric.ts         ← Face ID + Fingerprint + PIN fallback
│   │   │   │   ├── useCheckoutTimer.ts     ← 8 jam lock logic
│   │   │   │   ├── useOfflineSync.ts
│   │   │   │   └── useWatermark.ts
│   │   │   ├── utils/
│   │   │   │   ├── dateTime.ts
│   │   │   │   ├── coordinate.ts           ← Format 6 desimal DD
│   │   │   │   ├── checkoutLock.ts         ← Validasi 8 jam
│   │   │   │   └── leaveBalance.ts
│   │   │   └── types/
│   │   │       └── index.ts                ← Semua TypeScript types
│   │   ├── app.json
│   │   ├── eas.json
│   │   ├── babel.config.js
│   │   └── package.json
│   │
│   └── web/                       ← Next.js 14
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx
│       │   │   ├── (auth)/
│       │   │   │   └── login/page.tsx
│       │   │   └── (dashboard)/
│       │   │       ├── layout.tsx          ← Sidebar + topbar wrapper
│       │   │       ├── page.tsx            ← Dashboard beranda
│       │   │       ├── monitoring/page.tsx ← Peta live GPS
│       │   │       ├── schedule/
│       │   │       │   ├── page.tsx
│       │   │       │   ├── shifts/page.tsx         ← Konfigurasi jam shift
│       │   │       │   ├── office-hours/page.tsx   ← Konfigurasi office hours
│       │   │       │   ├── visits/page.tsx
│       │   │       │   ├── leave/page.tsx
│       │   │       │   └── oncall/page.tsx
│       │   │       ├── attendance/page.tsx
│       │   │       ├── visits/page.tsx
│       │   │       ├── tasks/page.tsx
│       │   │       ├── service-reports/page.tsx
│       │   │       ├── reports/page.tsx
│       │   │       ├── employees/page.tsx
│       │   │       └── settings/page.tsx
│       │   ├── components/
│       │   │   ├── ui/                     ← shadcn/ui + custom glass
│       │   │   │   ├── GlassCard.tsx
│       │   │   │   ├── MetricCard.tsx
│       │   │   │   ├── BentoGrid.tsx
│       │   │   │   ├── Sidebar.tsx
│       │   │   │   ├── Topbar.tsx
│       │   │   │   └── DataTable.tsx
│       │   │   ├── monitoring/
│       │   │   │   ├── LiveMap.tsx         ← Google Maps + pin teknisi
│       │   │   │   ├── TechnicianPin.tsx
│       │   │   │   └── GPSAlertBadge.tsx
│       │   │   ├── schedule/
│       │   │   │   ├── ShiftConfigurator.tsx  ← Konfigurasi jam (validasi 8j)
│       │   │   │   ├── DurationValidator.tsx
│       │   │   │   ├── WeeklyScheduler.tsx    ← Timeline view
│       │   │   │   └── AssignmentGrid.tsx     ← Grid assign karyawan
│       │   │   ├── visits/
│       │   │   │   ├── PhotoGallery.tsx
│       │   │   │   ├── WatermarkPreview.tsx
│       │   │   │   └── ReportViewer.tsx
│       │   │   └── dispatch/
│       │   │       ├── TaskBoard.tsx
│       │   │       ├── AssignModal.tsx
│       │   │       └── ApprovalCard.tsx
│       │   ├── lib/
│       │   │   ├── api.ts
│       │   │   ├── auth.ts
│       │   │   └── socket.ts               ← Socket.io realtime
│       │   ├── stores/
│       │   │   ├── monitoring.store.ts
│       │   │   └── schedule.store.ts
│       │   └── types/
│       │       └── index.ts
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       └── package.json
│
├── backend/                       ← NestJS
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   ├── refresh-token.strategy.ts
│   │   │   │   └── auth.module.ts
│   │   │   ├── users/
│   │   │   │   ├── users.controller.ts
│   │   │   │   ├── users.service.ts
│   │   │   │   ├── entities/user.entity.ts
│   │   │   │   ├── dto/
│   │   │   │   └── users.module.ts
│   │   │   ├── attendance/
│   │   │   │   ├── attendance.controller.ts
│   │   │   │   ├── attendance.service.ts
│   │   │   │   ├── checkout.validator.ts       ← Logic 8 jam lock
│   │   │   │   ├── auto-checkout.job.ts        ← Cron: auto CO di shift_end
│   │   │   │   ├── alfa-detector.job.ts        ← Cron: deteksi alfa
│   │   │   │   ├── entities/attendance.entity.ts
│   │   │   │   └── attendance.module.ts
│   │   │   ├── schedule/
│   │   │   │   ├── shift-types.service.ts
│   │   │   │   ├── office-hours.service.ts
│   │   │   │   ├── schedule-generator.service.ts ← Auto-gen jadwal harian
│   │   │   │   ├── duration.validator.ts         ← Validasi tepat 8 jam
│   │   │   │   ├── entities/
│   │   │   │   └── schedule.module.ts
│   │   │   ├── visits/
│   │   │   │   ├── visits.controller.ts
│   │   │   │   ├── visits.service.ts
│   │   │   │   ├── photo-watermark.service.ts  ← Puppeteer/Canvas watermark
│   │   │   │   ├── reverse-geocode.service.ts  ← Google Maps + Redis cache
│   │   │   │   ├── entities/
│   │   │   │   └── visits.module.ts
│   │   │   ├── service-reports/
│   │   │   │   ├── reports.service.ts
│   │   │   │   ├── pdf-generator.service.ts    ← Puppeteer + Handlebars
│   │   │   │   ├── report-number.service.ts    ← BA-YYYY/MM/NNN
│   │   │   │   ├── entities/
│   │   │   │   └── reports.module.ts
│   │   │   ├── tasks/
│   │   │   │   ├── tasks.controller.ts
│   │   │   │   ├── tasks.service.ts
│   │   │   │   ├── dispatch.service.ts         ← Assign/broadcast logic
│   │   │   │   ├── auto-assign.job.ts          ← Cron: timeout auto-assign
│   │   │   │   ├── entities/
│   │   │   │   └── tasks.module.ts
│   │   │   ├── delegations/
│   │   │   │   ├── delegations.service.ts
│   │   │   │   ├── entities/
│   │   │   │   └── delegations.module.ts
│   │   │   ├── leave/
│   │   │   │   ├── leave.service.ts
│   │   │   │   ├── leave-accrual.job.ts        ← Cron: tgl 1 tiap bulan
│   │   │   │   ├── leave-expiry.job.ts         ← Cron: 31 Des 23:55
│   │   │   │   ├── alfa-deduction.service.ts   ← Engine potong cuti alfa
│   │   │   │   ├── objection.service.ts        ← Handle keberatan karyawan
│   │   │   │   ├── entities/
│   │   │   │   └── leave.module.ts
│   │   │   ├── notifications/
│   │   │   │   ├── notifications.service.ts
│   │   │   │   ├── fcm.service.ts              ← Firebase push notif
│   │   │   │   ├── whatsapp.service.ts         ← whatsapp-web.js
│   │   │   │   ├── email.service.ts            ← Resend.com
│   │   │   │   └── notifications.module.ts
│   │   │   ├── routing/
│   │   │   │   ├── osrm.service.ts
│   │   │   │   ├── nominatim.service.ts
│   │   │   │   └── routing.module.ts
│   │   │   ├── storage/
│   │   │   │   ├── storage.service.ts          ← Cloudflare R2
│   │   │   │   └── storage.module.ts
│   │   │   └── reports/
│   │   │       ├── reports.controller.ts
│   │   │       ├── excel-export.service.ts     ← SheetJS
│   │   │       └── reports.module.ts
│   │   ├── common/
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   └── roles.guard.ts
│   │   │   ├── decorators/
│   │   │   │   └── roles.decorator.ts
│   │   │   ├── interceptors/
│   │   │   │   └── audit-log.interceptor.ts
│   │   │   └── filters/
│   │   │       └── http-exception.filter.ts
│   │   ├── database/
│   │   │   ├── migrations/
│   │   │   │   ├── 001_users_roles_departments.ts
│   │   │   │   ├── 002_locations_clients.ts
│   │   │   │   ├── 003_schedule_types.ts
│   │   │   │   ├── 004_attendances.ts
│   │   │   │   ├── 005_leave_system.ts
│   │   │   │   ├── 006_visits_photos.ts
│   │   │   │   ├── 007_service_reports.ts
│   │   │   │   ├── 008_tasks_dispatch.ts
│   │   │   │   ├── 009_delegations.ts
│   │   │   │   └── 010_notifications_audit.ts
│   │   │   └── seeds/
│   │   │       ├── roles.seed.ts
│   │   │       └── national-holidays.seed.ts
│   │   ├── config/
│   │   │   ├── database.config.ts
│   │   │   ├── redis.config.ts
│   │   │   ├── aws.config.ts
│   │   │   └── app.config.ts
│   │   ├── gateway/
│   │   │   └── realtime.gateway.ts             ← Socket.io WebSocket
│   │   └── main.ts
│   ├── templates/                              ← Handlebars PDF templates
│   │   ├── service-report.hbs                 ← Template berita acara
│   │   ├── attendance-report.hbs
│   │   └── assets/
│   │       └── styles.css
│   ├── test/
│   ├── .env.example
│   ├── docker-compose.yml
│   └── package.json
│
└── shared/                        ← Package TypeScript bersama
    ├── src/
    │   ├── types/
    │   │   ├── user.types.ts
    │   │   ├── attendance.types.ts
    │   │   ├── visit.types.ts
    │   │   ├── task.types.ts
    │   │   └── leave.types.ts
    │   ├── constants/
    │   │   ├── roles.ts
    │   │   ├── status.ts
    │   │   └── enums.ts
    │   └── validators/
    │       ├── coordinate.validator.ts
    │       └── duration.validator.ts
    └── package.json
```

---


---

## 4. DATABASE SCHEMA LENGKAP (50 Tabel)

### 4.1 Users & Auth
```sql
-- TABEL: users
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       VARCHAR(20) UNIQUE NOT NULL,
  name              VARCHAR(100) NOT NULL,
  email             VARCHAR(150) UNIQUE NOT NULL,
  phone             VARCHAR(20) NOT NULL,
  password_hash     VARCHAR NOT NULL,
  role_id           UUID REFERENCES roles(id),
  department_id     UUID REFERENCES departments(id),
  location_id       UUID REFERENCES locations(id),
  schedule_type     VARCHAR(20) CHECK (schedule_type IN ('shift','office_hours')),
  is_senior         BOOLEAN DEFAULT FALSE,
  pin_hash          VARCHAR,
  -- PIN 6 digit fallback untuk absensi (bcrypt hash)
  -- Di-set karyawan saat first login
  -- Hanya dipakai jika HP tidak support biometrik
  avatar_url        VARCHAR,
  is_active         BOOLEAN DEFAULT TRUE,
  fcm_token         VARCHAR, -- DEPRECATED: gunakan tabel user_devices
  -- FCM token dipindah ke tabel user_devices untuk support multi-device
  must_change_password BOOLEAN DEFAULT TRUE,
  -- TRUE saat karyawan baru dibuat admin → paksa ganti password saat first login
  -- face_enrolled DIHAPUS: biometrik dikelola oleh OS HP, tidak perlu enrollment
  -- pin_hash sudah ada di atas
  last_login_at     TIMESTAMP,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

-- TABEL: roles
CREATE TABLE roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(50) UNIQUE NOT NULL, -- admin|manager|senior|junior
  permissions     JSONB,
  can_delegate    BOOLEAN DEFAULT FALSE,
  can_approve     BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- TABEL: departments
CREATE TABLE departments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  code        VARCHAR(10) UNIQUE,
  manager_id  UUID REFERENCES users(id),
  created_at  TIMESTAMP DEFAULT NOW()
);

-- TABEL: locations (kantor & geofence)
CREATE TABLE locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  address       TEXT,
  lat           DECIMAL(10,6) NOT NULL,
  lng           DECIMAL(10,6) NOT NULL,
  radius_meter  INTEGER DEFAULT 100,
  is_active     BOOLEAN DEFAULT TRUE
);

-- TABEL: refresh_tokens
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR NOT NULL,
  expires_at  TIMESTAMP NOT NULL,
  revoked_at  TIMESTAMP,
  device_info JSONB
);

-- TABEL: user_devices (support multi-device per karyawan)
-- Menggantikan kolom fcm_token di tabel users
CREATE TABLE user_devices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  fcm_token     VARCHAR NOT NULL,
  device_name   VARCHAR(100),           -- "Samsung Galaxy A54", "iPhone 13"
  platform      VARCHAR(10) NOT NULL,   -- android | ios
  app_version   VARCHAR(20),            -- versi app yang terinstall
  is_active     BOOLEAN DEFAULT TRUE,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, fcm_token)            -- cegah duplikasi token per user
);
-- Saat login: upsert berdasarkan fcm_token
-- Saat logout: set is_active = FALSE untuk device tersebut
-- Kirim notif: query semua user_devices WHERE user_id = ? AND is_active = TRUE

-- TABEL: password_reset_tokens (untuk alur lupa password)
CREATE TABLE password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR NOT NULL,         -- hash dari OTP 6 digit
  expires_at  TIMESTAMPTZ NOT NULL,     -- berlaku 15 menit
  used_at     TIMESTAMPTZ,              -- NULL = belum dipakai
  channel     VARCHAR(10) NOT NULL,     -- email | whatsapp
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Jadwal
```sql
-- TABEL: shift_types (jam dikonfigurasi admin, validasi 8 jam)
CREATE TABLE shift_types (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(50) NOT NULL,
  start_time          TIME NOT NULL,
  end_time            TIME NOT NULL,
  duration_minutes    INTEGER GENERATED ALWAYS AS
                        (EXTRACT(EPOCH FROM (end_time - start_time))/60)::integer STORED,
  tolerance_minutes   INTEGER DEFAULT 60,
  color_hex           VARCHAR(7) DEFAULT '#007AFF',
  department_id       UUID REFERENCES departments(id),
  is_active           BOOLEAN DEFAULT TRUE,
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMP DEFAULT NOW(),
  CONSTRAINT chk_duration CHECK (
    CASE
      WHEN end_time > start_time
        THEN (EXTRACT(EPOCH FROM (end_time - start_time))/60)::integer
      ELSE (EXTRACT(EPOCH FROM (end_time - start_time + INTERVAL '24 hours'))/60)::integer
    END = 480
  )
  -- Constraint ini handle shift normal (07:00-15:00)
  -- DAN shift lintas tengah malam (22:00-06:00)
);

-- TABEL: office_hours_config (set sekali, berlaku otomatis)
CREATE TABLE office_hours_config (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id),
  department_id       UUID REFERENCES departments(id),
  start_time          TIME NOT NULL,
  end_time            TIME NOT NULL,
  duration_minutes    INTEGER GENERATED ALWAYS AS
                        (EXTRACT(EPOCH FROM (end_time - start_time))/60)::integer STORED,
  work_days           JSONB DEFAULT '["Mon","Tue","Wed","Thu","Fri"]',
  tolerance_minutes   INTEGER DEFAULT 60,
  effective_date      DATE NOT NULL,
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMP DEFAULT NOW(),
  CONSTRAINT chk_oh_duration CHECK (
    CASE
      WHEN end_time > start_time
        THEN (EXTRACT(EPOCH FROM (end_time - start_time))/60)::integer
      ELSE (EXTRACT(EPOCH FROM (end_time - start_time + INTERVAL '24 hours'))/60)::integer
    END = 480
  )
  -- Sama dengan shift_types, support jam lintas tengah malam
);

-- TABEL: user_schedules (snapshot jadwal per hari)
CREATE TABLE user_schedules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id),
  shift_type_id       UUID REFERENCES shift_types(id),
  schedule_type       VARCHAR(20),
  date                DATE NOT NULL,
  start_time          TIME NOT NULL,
  end_time            TIME NOT NULL,
  tolerance_minutes   INTEGER DEFAULT 60,
  is_holiday          BOOLEAN DEFAULT FALSE,
  is_day_off          BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMP DEFAULT NOW()
);

-- TABEL: national_holidays
CREATE TABLE national_holidays (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                DATE UNIQUE NOT NULL,
  name                VARCHAR(100) NOT NULL,
  year                INTEGER NOT NULL,
  is_active           BOOLEAN DEFAULT TRUE,
  is_collective_leave BOOLEAN DEFAULT FALSE,
  -- FALSE = hari libur biasa (tidak potong saldo cuti)
  -- TRUE  = cuti bersama pemerintah (potong saldo cuti otomatis)
  created_by          UUID REFERENCES users(id)
);

-- TABEL: clients
CREATE TABLE clients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(150) NOT NULL,
  pic_name      VARCHAR(100),
  pic_phone     VARCHAR(20),
  pic_email     VARCHAR(150),
  address       TEXT,
  lat           DECIMAL(10,6),
  lng           DECIMAL(10,6),
  radius_meter  INTEGER DEFAULT 200,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- TABEL: company_leave_config (semua nilai bisa dikonfigurasi admin)
CREATE TABLE company_leave_config (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  max_leave_days_per_year     INTEGER DEFAULT 12,
  monthly_accrual_amount      DECIMAL(3,1) DEFAULT 1.0,
  holiday_work_credit         DECIMAL(3,1) DEFAULT 1.0,
  alfa_deduction_amount       DECIMAL(3,1) DEFAULT 1.0,
  objection_window_hours      INTEGER DEFAULT 24,
  expiry_reminder_days        JSONB DEFAULT '[30, 7]',
  effective_date              DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_by                  UUID REFERENCES users(id),
  updated_at                  TIMESTAMP DEFAULT NOW()
);
```

### 4.3 Absensi & Cuti
```sql
-- TABEL: attendances
CREATE TABLE attendances (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES users(id),
  user_schedule_id      UUID REFERENCES user_schedules(id),
  date                  DATE NOT NULL,
  schedule_type         VARCHAR(20),
  shift_start           TIME,
  shift_end             TIME,
  tolerance_minutes     INTEGER DEFAULT 60,
  check_in_at           TIMESTAMP,
  check_in_method       VARCHAR(20),
  -- face_id    : Face ID sensor HP (expo-local-authentication)
  -- fingerprint: Fingerprint sensor HP (expo-local-authentication)
  -- pin        : PIN 6 digit (fallback jika biometrik tidak support)
  -- qr         : QR Code scan (alternatif dalam gedung)
  -- gps        : GPS geofence saja (fallback terakhir)
  check_in_lat          DECIMAL(10,6),
  check_in_lng          DECIMAL(10,6),
  -- CATATAN: check_in_selfie_url DIHAPUS
  -- Tidak ada selfie saat check-in (biometrik cukup untuk verifikasi)
  check_in_location_id  UUID REFERENCES locations(id),
  check_out_at          TIMESTAMP,
  check_out_method      VARCHAR(10), -- manual|auto
  checkout_earliest     TIMESTAMPTZ, -- diisi saat check-in: check_in_at + 8 jam
  -- CATATAN: BUKAN generated column karena check_in_at nullable saat row dibuat
  -- Diisi otomatis oleh service saat check-in berhasil
  status                VARCHAR(20) DEFAULT 'alfa',
                        -- hadir|terlambat|alfa|izin|sakit|dinas
  late_minutes          INTEGER DEFAULT 0,
  overtime_minutes      INTEGER DEFAULT 0,
  is_holiday_work       BOOLEAN DEFAULT FALSE,
  notes                 TEXT,
  created_at            TIMESTAMP DEFAULT NOW()
);

-- TABEL: leave_balances
CREATE TABLE leave_balances (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES users(id),
  year                  INTEGER NOT NULL,
  balance_days          DECIMAL(5,1) DEFAULT 0,
  accrued_monthly       INTEGER DEFAULT 0,
  accrued_holiday       INTEGER DEFAULT 0,
  used_days             DECIMAL(5,1) DEFAULT 0,
  expired_days          DECIMAL(5,1) DEFAULT 0,
  last_accrual_month    INTEGER,
  last_accrual_date     DATE,
  updated_at            TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, year)
);

-- TABEL: leave_requests
CREATE TABLE leave_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  type            VARCHAR(20), -- cuti|izin|sakit|dinas
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  total_days      INTEGER,
  reason          TEXT,
  attachment_url  VARCHAR,
  status          VARCHAR(20) DEFAULT 'pending', -- pending|approved|rejected
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMP,
  reject_reason   TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- TABEL: leave_balance_logs (audit trail setiap mutasi saldo)
CREATE TABLE leave_balance_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  type            VARCHAR(30),
  -- accrual_monthly|accrual_holiday|used|expired|
  -- alfa_deduction|accrual_skipped|objection_cancel|manual_adjustment
  amount          DECIMAL(5,1),
  balance_after   DECIMAL(5,1),
  reference_id    UUID,
  notes           VARCHAR,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- TABEL: pending_deductions (buffer 24 jam sebelum potong)
CREATE TABLE pending_deductions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  attendance_id   UUID REFERENCES attendances(id),
  amount          DECIMAL(3,1) DEFAULT 1.0,
  status          VARCHAR(20) DEFAULT 'pending',
  -- pending|executed|auto_executed|cancelled
  deadline_at     TIMESTAMP NOT NULL,
  executed_at     TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- TABEL: leave_objections (keberatan karyawan)
CREATE TABLE leave_objections (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pending_deduction_id  UUID REFERENCES pending_deductions(id),
  user_id               UUID REFERENCES users(id),
  reason                TEXT NOT NULL,
  evidence_url          VARCHAR,
  status                VARCHAR(20) DEFAULT 'pending',
  reviewed_by           UUID REFERENCES users(id),
  reviewed_at           TIMESTAMP,
  reject_reason         TEXT,
  created_at            TIMESTAMP DEFAULT NOW()
);

-- TABEL: attendance_violations (alfa saat saldo 0)
CREATE TABLE attendance_violations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES users(id),
  attendance_id     UUID REFERENCES attendances(id),
  type              VARCHAR(30) DEFAULT 'alfa_no_balance',
  description       TEXT,
  balance_at_time   DECIMAL(5,1) DEFAULT 0,
  is_resolved       BOOLEAN DEFAULT FALSE,
  resolved_by       UUID REFERENCES users(id),
  resolved_at       TIMESTAMP,
  resolution_notes  TEXT,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- TABEL: warning_letters (Surat Peringatan digital)
CREATE TABLE warning_letters (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES users(id),
  level                 VARCHAR(5) NOT NULL CHECK (level IN ('SP1','SP2','SP3')),
  -- SP1: peringatan pertama
  -- SP2: peringatan kedua (eskalasi dari SP1)
  -- SP3: peringatan terakhir sebelum tindakan lebih berat
  reason                TEXT NOT NULL,
  reference_violation_id UUID REFERENCES attendance_violations(id),
  -- violation yang menjadi dasar SP (opsional, bisa manual)
  issued_by             UUID REFERENCES users(id),    -- admin/HR yang buat
  issued_at             DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until           DATE,                         -- masa berlaku SP
  acknowledged_by       UUID REFERENCES users(id),    -- karyawan yang TTD terima
  acknowledged_at       TIMESTAMPTZ,                  -- kapan karyawan terima
  doc_url               VARCHAR,                      -- PDF surat yang sudah di-generate
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.4 Kunjungan & Berita Acara
```sql
-- TABEL: visits
CREATE TABLE visits (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id               UUID REFERENCES tasks(id),      -- nullable: kunjungan bisa tanpa tugas (lihat business rules 5.4)
  template_id           UUID REFERENCES work_type_templates(id), -- template BA yang digunakan
  user_id               UUID REFERENCES users(id),
  client_id             UUID REFERENCES clients(id),
  check_in_at           TIMESTAMP,
  check_in_lat          DECIMAL(10,6),
  check_in_lng          DECIMAL(10,6),
  check_in_address      VARCHAR,
  check_in_district     VARCHAR,    -- Kabupaten dari reverse geocoding
  check_in_province     VARCHAR,    -- Provinsi dari reverse geocoding
  gps_valid             BOOLEAN DEFAULT FALSE,
  gps_deviation_meter   INTEGER,
  check_out_at          TIMESTAMP,
  work_description      TEXT,
  findings              TEXT,
  recommendations       TEXT,
  materials_used        JSONB,
  status                VARCHAR(20) DEFAULT 'ongoing',
  route_polyline        TEXT,
  duration_minutes      INTEGER,
  created_at            TIMESTAMP DEFAULT NOW()
);

-- TABEL: visit_photos (foto per fase + watermark)
CREATE TABLE visit_photos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id        UUID REFERENCES visits(id),
  phase           VARCHAR(10), -- before|during|after
  seq_number      INTEGER,
  original_url    VARCHAR NOT NULL,
  thumbnail_url   VARCHAR,
  watermarked_url VARCHAR NOT NULL,  -- URL foto dengan watermark burned
  caption         VARCHAR(255),
  taken_at        TIMESTAMP NOT NULL,
  lat             DECIMAL(10,6),     -- GPS saat foto diambil
  lng             DECIMAL(10,6),
  district        VARCHAR,           -- Kabupaten dari reverse geocoding
  province        VARCHAR,           -- Provinsi dari reverse geocoding
  file_size_kb    INTEGER,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- TABEL: service_reports (berita acara)
CREATE TABLE service_reports (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id              UUID UNIQUE REFERENCES visits(id),
  report_number         VARCHAR(30) UNIQUE,  -- BA-2025/04/001
  technician_id         UUID REFERENCES users(id),
  client_id             UUID REFERENCES clients(id),
  client_pic_name       VARCHAR,
  tech_signature_url    VARCHAR,
  client_signature_url  VARCHAR,
  client_signature_type VARCHAR(20), -- digital|photo_upload
  signed_at             TIMESTAMP,
  pdf_url               VARCHAR,
  pdf_generated_at      TIMESTAMP,
  is_locked             BOOLEAN DEFAULT FALSE,
  sent_to_client        BOOLEAN DEFAULT FALSE,
  sent_at               TIMESTAMP,
  created_at            TIMESTAMP DEFAULT NOW()
);
```

### 4.5 Dispatch & Delegasi
```sql
-- TABEL: tasks
CREATE TABLE tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title               VARCHAR(200) NOT NULL,
  description         TEXT,
  type                VARCHAR(30), -- visit|maintenance|inspection|other
  priority            VARCHAR(10) DEFAULT 'normal', -- normal|high|urgent
  status              VARCHAR(20) DEFAULT 'unassigned',
  -- unassigned  : belum ada teknisi
  -- pending     : menunggu konfirmasi teknisi
  -- assigned    : teknisi sudah terima
  -- ongoing     : kunjungan sedang berjalan
  -- on_hold     : ditunda sementara dengan bukti (pending by evidence)
  -- rescheduled : dijadwalkan ulang setelah on_hold diapprove
  -- completed   : selesai dengan BA
  -- cancelled   : dibatalkan manajer/admin
  client_id           UUID REFERENCES clients(id),
  location_id         UUID REFERENCES locations(id),
  assigned_to         UUID REFERENCES users(id),
  created_by          UUID REFERENCES users(id),
  dispatch_type       VARCHAR(10), -- direct|broadcast
  broadcast_dept_id   UUID REFERENCES departments(id),
  confirm_deadline    TIMESTAMP,
  scheduled_at        TIMESTAMP,
  completed_at        TIMESTAMP,
  is_emergency        BOOLEAN DEFAULT FALSE,
  template_id         UUID REFERENCES work_type_templates(id), -- template BA wajib dipilih saat buat tugas
  escalated_at        TIMESTAMPTZ,           -- kapan prioritas otomatis di-eskalasi
  escalated_from      VARCHAR(10),           -- prioritas sebelum eskalasi (normal→high→urgent)
  escalation_notif_sent BOOLEAN DEFAULT FALSE,
  rescheduled_date    DATE,                  -- tanggal kunjungan ulang setelah on_hold
  rescheduled_assign_to UUID REFERENCES users(id), -- siapa yang in-charge setelah reschedule
  notes               TEXT,
  created_at          TIMESTAMP DEFAULT NOW()
);

-- TABEL: task_holds (Pending by Evidence — bukti penundaan pekerjaan)
CREATE TABLE task_holds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID REFERENCES tasks(id),
  visit_id        UUID REFERENCES visits(id),    -- visit yang sedang berjalan saat hold
  held_by         UUID REFERENCES users(id),     -- teknisi yang request on_hold
  reason_type     VARCHAR(30) NOT NULL,
  -- client_absent      : klien/PIC tidak ada di lokasi
  -- access_denied      : tidak bisa masuk gedung/area
  -- equipment_broken   : peralatan teknisi rusak
  -- material_unavailable: spare part/material belum tersedia
  -- client_cancel      : klien batalkan sepihak
  -- weather            : cuaca ekstrem tidak memungkinkan
  -- technician_sick    : teknisi sakit mendadak di lokasi
  -- other              : alasan lain (wajib isi reason_notes)
  reason_notes    TEXT NOT NULL,                 -- keterangan detail wajib diisi
  evidence_urls   JSONB NOT NULL,               -- array URL foto bukti (min 1, max 5)
  held_at         TIMESTAMPTZ DEFAULT NOW(),
  -- REVIEW OLEH MANAJER:
  reviewed_by     UUID REFERENCES users(id),
  review_status   VARCHAR(20) DEFAULT 'pending',
  -- pending | approved | rejected
  reviewed_at     TIMESTAMPTZ,
  reject_reason   TEXT,                          -- jika rejected: alasan penolakan
  -- RESCHEDULE (diisi manajer saat approve):
  reschedule_date DATE,                          -- tanggal kunjungan ulang
  reschedule_note TEXT,                          -- instruksi tambahan untuk teknisi
  -- AUTO-APPROVE jika manajer tidak respons sesuai batas waktu:
  auto_approve_at TIMESTAMPTZ,                   -- deadline review (set saat hold dibuat)
  -- Normal: +4 jam, High: +2 jam, Urgent: +30 menit
  is_auto_approved BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- TABEL: task_assignments (history setiap assign)
CREATE TABLE task_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID REFERENCES tasks(id),
  user_id       UUID REFERENCES users(id),
  status        VARCHAR(20), -- offered|accepted|rejected|auto_assigned
  offered_at    TIMESTAMP NOT NULL,
  responded_at  TIMESTAMP,
  reject_reason TEXT,
  is_current    BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- TABEL: delegations
CREATE TABLE delegations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID REFERENCES tasks(id),
  from_user_id    UUID REFERENCES users(id),
  to_user_id      UUID REFERENCES users(id),
  type            VARCHAR(10), -- delegate|swap
  reason          TEXT NOT NULL,
  status          VARCHAR(20) DEFAULT 'pending',
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMP,
  reject_reason   TEXT,
  swap_task_id    UUID REFERENCES tasks(id),
  created_at      TIMESTAMP DEFAULT NOW()
);

-- TABEL: notifications
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  type        VARCHAR(30), -- task|delegation|attendance|leave|system
  title       VARCHAR(200),
  body        TEXT,
  data        JSONB,
  channel     VARCHAR(20), -- push|whatsapp|email|in_app
  is_read     BOOLEAN DEFAULT FALSE,
  read_at     TIMESTAMP,
  sent_at     TIMESTAMP,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- TABEL: audit_logs
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  action      VARCHAR(100),
  entity_type VARCHAR(50),
  entity_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  VARCHAR,
  created_at  TIMESTAMP DEFAULT NOW()
);
```

---

### 4.6 Ringkasan Lengkap 50 Tabel

```
USERS & AUTH (6 tabel):
 1. users                    ← karyawan + must_change_password + pin_hash
 2. roles                    ← admin | manager | senior | junior
 3. departments              ← departemen perusahaan
 4. locations                ← lokasi kantor + geofence
 5. refresh_tokens           ← JWT refresh token management
 6. user_devices             ← multi-device FCM token (bukan di users)
 7. password_reset_tokens    ← OTP lupa password (15 menit expired)

JADWAL & KLIEN (7 tabel):
 8. shift_types              ← tipe shift (validasi CASE WHEN 8 jam + shift malam)
 9. office_hours_config      ← jam kantor per karyawan/dept
10. user_schedules           ← snapshot jadwal harian per karyawan
11. national_holidays        ← hari libur + is_collective_leave (cuti bersama)
12. clients                  ← klien + kontrak + SLA + priority_level
13. client_visit_quotas      ← kuota kunjungan bulanan per klien
14. company_leave_config     ← konfigurasi aturan cuti perusahaan

ABSENSI & CUTI (10 tabel):
15. attendances              ← check-in/out (checkout_earliest = TIMESTAMPTZ biasa)
16. leave_balances           ← saldo cuti per karyawan per tahun
17. leave_requests           ← pengajuan cuti/izin/sakit/dinas
18. leave_balance_logs       ← audit trail setiap mutasi saldo cuti
19. pending_deductions       ← buffer 24 jam sebelum potong cuti alfa
20. leave_objections         ← keberatan karyawan atas pemotongan alfa
21. attendance_violations    ← alfa saat saldo 0 (tidak dipotong)
22. warning_letters          ← SP1/SP2/SP3 digital dengan TTD karyawan
23. business_trips           ← surat tugas dinas resmi
24. sla_breaches             ← log pelanggaran SLA klien

KUNJUNGAN & BERITA ACARA (8 tabel):
25. visits                   ← kunjungan lapangan (+ template_id)
26. visit_photos             ← foto 3 fase + metadata watermark
27. service_reports          ← berita acara PDF (locked setelah TTD)
28. work_type_templates      ← template BA per jenis pekerjaan
29. template_sections        ← seksi dalam template
30. template_fields          ← field dalam setiap seksi
31. template_photo_requirements ← syarat foto per fase per template
32. visit_form_responses     ← jawaban teknisi saat kunjungan

TUGAS & DISPATCH (6 tabel):
33. tasks                    ← tugas + prioritas + eskalasi + on_hold fields
34. task_assignments         ← history setiap assign ke teknisi
35. task_holds               ← pending by evidence (foto bukti + alasan)
36. delegations              ← delegasi & swap jadwal antar teknisi

NOTIFIKASI & AUDIT (3 tabel):
37. notifications            ← history semua notifikasi
38. audit_logs               ← audit trail semua aksi penting
39. announcements            ← pengumuman perusahaan
40. announcement_reads       ← tracking siapa sudah baca pengumuman

KLAIM BIAYA (3 tabel):
41. expense_claims           ← klaim biaya lapangan teknisi
42. expense_claim_logs       ← audit trail klaim
43. company_expense_config   ← batas klaim per kategori

SOS & DARURAT (3 tabel):
44. sos_alerts               ← rekaman SOS darurat
45. sos_location_tracks      ← tracking GPS selama SOS aktif
46. emergency_contacts       ← kontak darurat perusahaan

BACKUP (2 tabel):
47. backup_logs              ← log setiap backup otomatis
48. restore_logs             ← log setiap restore

LAIN-LAIN (2 tabel):
49. report_sequences         ← counter nomor BA-YYYY/MM/NNN (thread-safe)
50. schedule_change_logs     ← histori perubahan jadwal karyawan

TOTAL: 50 TABEL
```


---

## 5. BUSINESS RULES & LOGIC

### 5.1 Auth & Keamanan Akun
```
FIRST TIME LOGIN (Karyawan Baru):
- Admin buat akun karyawan → must_change_password = TRUE
- Password default: employee_id karyawan (contoh: EMP-001)
- Saat login pertama kali:
  * Backend cek must_change_password = TRUE
  * Return response khusus: { requirePasswordChange: true, temp_token: "..." }
  * Mobile/Web redirect ke halaman "Ganti Password"
  * Karyawan wajib isi password baru (min 8 karakter, 1 huruf besar, 1 angka)
  * Setelah ganti → must_change_password = FALSE → redirect ke beranda

LUPA PASSWORD (Forgot Password):
1. Karyawan tekan "Lupa Password" di halaman login
2. Input email atau nomor HP
3. Sistem cari user berdasarkan email atau phone
4. Jika ditemukan:
   - Generate OTP 6 digit acak
   - Hash OTP → simpan ke password_reset_tokens (expires 15 menit)
   - Kirim OTP via:
     * Email (Resend.com) jika input email
     * WhatsApp jika input nomor HP
5. Karyawan input OTP → verifikasi hash vs database
6. Jika valid → return reset_token (JWT 5 menit)
7. Karyawan input password baru → POST /auth/reset-password
8. Hapus/invalidasi semua refresh_tokens lama
9. Set must_change_password = FALSE
10. Redirect ke login

KEAMANAN PASSWORD:
- Hash: bcrypt dengan salt rounds 12
- Minimum: 8 karakter, 1 huruf besar, 1 angka
- Tidak boleh sama dengan password sebelumnya (cek hash)
- Session timeout: access token 15 menit, refresh token 7 hari
- Revoke semua refresh token saat ganti password
```

### 5.2 Biometrik — Face ID, Fingerprint & PIN Fallback
```
KONSEP UTAMA:
Verifikasi biometrik terjadi SEPENUHNYA di device karyawan.
Tidak ada data wajah atau sidik jari yang dikirim ke server.
Sama persis dengan cara membuka HP — OS yang memverifikasi,
app hanya terima hasil: berhasil atau gagal.

LIBRARY: expo-local-authentication (React Native + Expo)
Mendukung: Face ID (iPhone), Face Unlock (Android),
           Fingerprint (semua HP modern)

SETUP (tidak perlu enrollment oleh admin):
- Karyawan cukup sudah setup Face ID atau Fingerprint di HP mereka
- App detect otomatis: ada biometrik atau tidak
- Tidak ada pendaftaran khusus di sistem — karyawan gunakan
  biometrik yang sama dengan yang mereka pakai buka HP

ALUR VERIFIKASI SAAT CHECK-IN:
┌─────────────────────────────────────────────────┐
│ HP support biometrik & sudah di-setup?          │
├─────────────────────────────────────────────────┤
│ YA → Tampilkan prompt Face ID / Fingerprint     │
│      (native OS prompt, sama seperti buka HP)   │
│      ↓                                          │
│      Berhasil → lanjut GPS validasi             │
│      Gagal 3x → turun ke PIN                    │
├─────────────────────────────────────────────────┤
│ TIDAK → Tampilkan input PIN 6 digit             │
│      ↓                                          │
│      PIN benar → lanjut GPS validasi            │
│      PIN salah 5x → lock 15 menit + notif HR   │
└─────────────────────────────────────────────────┘

SETELAH BIOMETRIK / PIN BERHASIL:
→ App validasi GPS geofence (lokasi wajib dalam radius kantor)
→ Jika GPS OK → check-in berhasil, kirim ke backend:
   { userId, timestamp, method, lat, lng }
→ Jika GPS di luar radius → warning + opsi QR / konfirmasi alasan

METODE CHECK-IN (urutan prioritas):
1. Face ID      — iPhone Face ID / Android face unlock
2. Fingerprint  — sensor sidik jari HP
3. PIN 6 digit  — fallback jika biometrik tidak tersedia
4. QR Code      — alternatif jika GPS tidak akurat (dalam gedung)

KEUNGGULAN PENDEKATAN INI vs AWS Rekognition:
✓ Jauh lebih ringan — tidak ada upload foto besar ke server
✓ Lebih aman — data biometrik tersimpan di Secure Enclave HP
  tidak bisa diretas atau bocor dari server
✓ Tetap bisa offline — verifikasi terjadi di device
✓ Gratis — tidak ada biaya per verifikasi ke AWS
✓ Tidak bisa ditipu foto — sensor 3D HP lebih canggih
✓ UU PDP Indonesia — data biometrik tidak keluar dari HP

PIN SETUP (saat first login):
1. Setelah ganti password wajib → sistem minta set PIN absensi
2. Input PIN 6 digit → confirm → simpan sebagai bcrypt hash di server
3. PIN berbeda dengan password login (lebih pendek, untuk kecepatan absen)
4. PIN bisa direset oleh admin jika lupa

DATA YANG DIKIRIM KE SERVER SAAT CHECK-IN:
{
  userId:    "uuid",
  timestamp: "2025-04-03T10:32:08+08:00",  // WITA
  method:    "face_id" | "fingerprint" | "pin" | "qr",
  lat:       -8.563291,   // 6 desimal
  lng:       115.087821,  // 6 desimal
  deviceId:  "uuid"       // dari tabel user_devices
}
// TIDAK ADA foto/gambar yang dikirim
```

### 5.3 Absensi
```
TOLERANSI KETERLAMBATAN: 60 menit dari jam mulai shift/office hours

STATUS BERDASARKAN CHECK-IN:
- check_in ≤ shift_start + 60 menit  → status = "hadir"
- check_in > shift_start + 60 menit  → status = "terlambat"
- check_in > shift_start + 4 jam     → status = "alfa"
- tidak check_in sama sekali         → status = "alfa"

late_minutes = MAX(0, check_in_time - shift_start_time) dalam menit

JAM CHECK-OUT:
- checkout_earliest = check_in_at + 8 jam (BUKAN jam shift selesai)
- Tombol check-out TERKUNCI sampai NOW() >= checkout_earliest
- Jika terlambat check-in → jam checkout ikut mundur
- Contoh: check-in 09:30 → checkout aktif 17:30

IMPLEMENTASI checkout_earliest (WAJIB DIIKUTI):
- Kolom checkout_earliest adalah TIMESTAMPTZ biasa (BUKAN GENERATED COLUMN)
- Diisi oleh AttendanceService.checkIn() sesaat setelah check_in_at di-set:
    attendance.check_in_at = new Date()
    attendance.checkout_earliest = addHours(attendance.check_in_at, 8)
    await this.attendanceRepo.save(attendance)
- JANGAN buat sebagai GENERATED ALWAYS AS — check_in_at nullable saat row dibuat
- Validasi di CheckoutValidator:
    canCheckout(attendance): boolean {
      if (!attendance.check_in_at) return false
      if (!attendance.checkout_earliest) return false
      return new Date() >= attendance.checkout_earliest
    }
    getRemainingSeconds(attendance): number {
      if (!attendance.checkout_earliest) return 0
      return Math.max(0, differenceInSeconds(attendance.checkout_earliest, new Date()))
    }

IMPLEMENTASI checkout_earliest (PENTING):
- Kolom checkout_earliest di tabel attendances adalah TIMESTAMPTZ biasa (bukan GENERATED)
- Diisi otomatis oleh AttendanceService.checkIn() sesaat setelah check_in_at di-set:
  attendance.checkout_earliest = addHours(attendance.check_in_at, 8)
- Jangan buat sebagai GENERATED ALWAYS AS karena check_in_at nullable saat row pertama dibuat
- Validasi di CheckOutValidator:
  if (NOW() < attendance.checkout_earliest) throw ForbiddenException
  return { canCheckout: false, remainingSeconds: diff }

AUTO CHECK-OUT:
- Cron job tiap menit cek karyawan yang belum checkout
- Jika NOW() >= shift_end_time AND check_out IS NULL:
    → set check_out_at = shift_end_time
    → set check_out_method = 'auto'
    → kirim notif ke karyawan + manajer
    → overtime_minutes = 0 (tidak ada lembur dari auto-checkout)

LEMBUR:
- overtime_minutes = MAX(0, actual_checkout - shift_end_time)
- Jika check_out_method = 'auto' → overtime = 0

HARI LIBUR NASIONAL:
- Jika check_in_at ada di tanggal yang terdaftar di national_holidays
    → set is_holiday_work = TRUE
    → credit saldo cuti +1 hari otomatis
```

### 5.4 Jadwal
```
VALIDASI JAM (WAJIB):
- Admin set start_time dan end_time
- Sistem validasi: (end_time - start_time) HARUS = 480 menit (8 jam)
- Jika bukan 8 jam → throw error "Durasi harus tepat 8 jam"

TIPE JADWAL:
1. SHIFT:
   - Jam bisa berbeda tiap hari/minggu
   - Admin assign per periode (mingguan/bulanan)
   - Sistem buat record user_schedules per hari

2. OFFICE HOURS:
   - Jam tetap sama setiap hari kerja
   - Admin set sekali di office_hours_config
   - Sistem auto-generate user_schedules harian via cron jam 23:00
   - Perubahan berlaku mulai effective_date (tidak retroaktif)

CRON SCHEDULE GENERATOR (tiap hari jam 23:00):
- Ambil semua karyawan dengan schedule_type = 'office_hours'
- Ambil config office_hours terbaru per karyawan
- Buat user_schedules untuk hari berikutnya
- Skip jika tanggal = national_holidays atau is_day_off
```

### 5.5 Izin Sakit — Aturan Surat Dokter
```
DEFINISI:
- Sakit adalah kondisi karyawan tidak bisa masuk karena alasan kesehatan
- BERBEDA dari cuti tahunan — sakit punya alokasi tersendiri
- Sakit TIDAK mengurangi saldo cuti tahunan (balance_days tidak berubah)

ATURAN SURAT DOKTER:
- Sakit 1–2 hari  : tidak perlu surat dokter, cukup laporan mandiri
- Sakit 3+ hari   : WAJIB upload foto surat dokter/surat keterangan sakit
- Sistem validasi : jika total_days >= 3 AND attachment_url IS NULL → reject otomatis
  dengan pesan: "Izin sakit 3 hari ke atas wajib menyertakan surat dokter"

ALOKASI SAKIT:
- Sakit tidak dipotong dari saldo cuti tahunan
- Tidak ada batas maksimum hari sakit (sesuai kondisi kesehatan)
- Jika karyawan sakit berkepanjangan (>30 hari) → HR handle manual sesuai UU

ALUR:
1. Karyawan ajukan izin sakit di app (bisa dilakukan pagi hari)
2. Pilih tipe = 'sakit', isi tanggal, alasan singkat
3. Jika >= 3 hari → upload foto surat dokter (wajib)
4. Manajer approve (bisa approve H+1 setelah karyawan masuk)
5. Status absensi di tanggal tersebut = 'sakit'
6. Tidak ada pending_deductions dibuat untuk status sakit

VALIDASI SISTEM:
- Tidak bisa ajukan izin sakit untuk tanggal yang sudah lewat > 3 hari
  (cegah manipulasi data historis)
- Jika karyawan belum ajukan izin di hari H → status default = 'alfa'
  karyawan harus ajukan izin sakit dan manajer approve untuk ubah status
```

### 5.6 Status Dinas — Surat Tugas Digital
```
DEFINISI DINAS:
- Dinas = penugasan resmi ke luar kota/lokasi yang berbeda dari kantor utama
- BERBEDA dari kunjungan klien biasa (kunjungan = dalam kota, hari itu pulang)
- Dinas biasanya melibatkan perjalanan lebih dari 1 hari

ALUR DINAS:
1. Admin/Manajer buat surat tugas digital di web:
   - Tujuan, tanggal mulai-selesai, karyawan yang ditugaskan
   - Tujuan penugasan, anggaran estimasi
   - Upload SK/surat tugas jika ada
2. Sistem set status absensi = 'dinas' untuk tanggal yang dicakup
3. Karyawan tidak perlu check-in GPS kantor di tanggal tersebut
4. Karyawan tetap bisa buat kunjungan lapangan selama dinas
5. Setelah selesai: karyawan upload laporan perjalanan dinas

ATURAN CUTI & ABSENSI DINAS:
- Dinas TIDAK mengurangi saldo cuti tahunan
- Dinas TIDAK dianggap alfa meski tidak check-in di kantor
- Jika ada hari libur di tengah periode dinas → tidak dihitung dinas
- Dinas tidak memerlukan approval cuti (sudah tercakup dalam surat tugas)

DATABASE:
CREATE TABLE business_trips (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  destination     VARCHAR(200) NOT NULL,       -- kota/lokasi tujuan
  purpose         TEXT NOT NULL,               -- tujuan penugasan
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  total_days      INTEGER,                     -- hari kerja dalam periode
  status          VARCHAR(20) DEFAULT 'approved',
  -- draft|approved|completed|cancelled
  approved_by     UUID REFERENCES users(id),
  attachment_url  VARCHAR,                     -- scan SK/surat tugas
  report_url      VARCHAR,                     -- laporan setelah selesai
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.7 Sistem Cuti
```
SUMBER CUTI:
1. Akrual bulanan: +1 hari per bulan (cron tgl 1 jam 00:01)
   - Skip jika balance_days >= max_leave_days_per_year
   - Log type = 'accrual_monthly'

2. Kerja di libur nasional: +1 hari (trigger check-in)
   - Dikreditkan meski sudah di batas maksimum
   - Log type = 'accrual_holiday'

BATAS MAKSIMUM:
- max_leave_days_per_year dari company_leave_config (default 12)
- Admin bisa ubah kapanpun

CUTI BERSAMA NASIONAL:
- Pemerintah Indonesia menetapkan cuti bersama setiap tahun (biasanya 5–8 hari)
- Berbeda dari libur nasional biasa → cuti bersama MEMOTONG saldo cuti karyawan
- Admin input cuti bersama di tabel national_holidays dengan is_collective_leave = TRUE
- Cron job harian jam 00:01 cek apakah besok ada is_collective_leave = TRUE:
  * Jika ada → potong saldo cuti semua karyawan aktif sebesar 1 hari
  * Log type = 'collective_leave_deduction'
  * Notif karyawan: "Saldo cuti dipotong 1 hari untuk cuti bersama [nama]"
- Jika karyawan sudah ambil cuti di tanggal tersebut → tidak dipotong ganda
- Jika saldo cuti = 0 saat cuti bersama → catat sebagai violation (tidak dipotong)

HANGUS AKHIR TAHUN (cron 31 Des 23:55):
- expired_days = balance_days
- balance_days = 0
- Log type = 'expired'
- Notif karyawan H-30 dan H-7 sebelumnya

PEMOTONGAN OTOMATIS (ALFA):
Trigger: karyawan tidak hadir tanpa keterangan (status = alfa)

Skenario A - Saldo > 0:
  1. Buat pending_deductions (status = 'pending')
  2. Kirim notif WA + push ke karyawan:
     "Anda tidak hadir hari ini. Saldo cuti akan dipotong 1 hari dalam 24 jam.
      Jika ada kekeliruan, ajukan keberatan sebelum [deadline]."
  3. Notif ke manajer (informasi saja)
  4. Tunggu 24 jam (objection_window_hours dari config)
  5a. Jika karyawan ajukan keberatan:
      - Buat leave_objections (status = 'pending')
      - Notif manajer untuk review
      - Manajer approve → pending_deductions status = 'cancelled', saldo tidak berubah
      - Manajer tolak → pending_deductions status = 'executed', balance -= 1
  5b. Jika tidak ada keberatan setelah 24 jam:
      - Cron auto-execute: pending_deductions status = 'auto_executed'
      - balance_days -= alfa_deduction_amount
      - Log type = 'alfa_deduction'

Skenario B - Saldo = 0:
  1. TIDAK buat pending_deductions
  2. Buat attendance_violations
  3. Notif karyawan + manajer:
     "Alfa tercatat sebagai pelanggaran. Saldo cuti Anda sudah 0."
  4. Sistem cek riwayat violations karyawan ini:
     - Violations ke-3 dalam 30 hari → notif HR: "Pertimbangkan SP1"
     - Violations ke-5 dalam 30 hari → notif HR: "Pertimbangkan SP2"
     - Violations ke-7 dalam 30 hari → notif HR: "Pertimbangkan SP3"
  5. HR buat Surat Peringatan (SP) dari web:
     - Pilih karyawan, level SP (SP1/SP2/SP3), alasan, masa berlaku
     - Sistem generate PDF SP dengan template resmi
     - Kirim notif ke karyawan: "Anda menerima SP1, silakan konfirmasi"
     - Karyawan acknowledge via TTD digital di app
  6. SP tersimpan di tabel warning_letters dengan audit trail lengkap

AMBIL CUTI:
- Karyawan ajukan leave_requests
- Sistem hitung total_days:
  * HANYA menghitung HARI KERJA (Senin–Jumat)
  * TIDAK termasuk Sabtu, Minggu, dan national_holidays
  * Contoh: cuti Jumat–Senin = 2 hari kerja (Jumat + Senin)
  * Contoh: cuti 1 minggu (Sen–Jum) = 5 hari kerja
- Sistem validasi: balance_days >= total_days
- Jika tidak cukup → tolak otomatis
- Manajer approve/reject
- Jika approved → balance_days -= total_days, log type = 'used'
```

### 5.8 Kunjungan & Foto
```
CHECK-IN KUNJUNGAN:
- GPS wajib aktif, validasi koordinat dalam radius klien
- Jika di luar radius → warning + konfirmasi alasan
- Selfie wajib saat check-in kunjungan

KUNJUNGAN TANPA TUGAS RESMI:
- TIDAK diizinkan. Setiap kunjungan WAJIB terhubung ke tugas resmi (task_id NOT NULL)
- Alasan: untuk audit trail, SLA monitoring, dan akuntabilitas
- Jika ada situasi darurat/mendadak → manajer buat tugas dulu (bisa < 1 menit)
  kemudian assign ke teknisi → teknisi mulai kunjungan
- task_id di tabel visits tetap nullable di DB tapi service layer wajib validasi:
  if (!dto.taskId) throw BadRequestException('Kunjungan harus terhubung ke tugas resmi')

FOTO (minimum 16 foto per kunjungan):
- Sebelum: minimum 5 foto, maksimum 20 foto
- Proses:  minimum 6 foto, maksimum 20 foto
- Sesudah: minimum 5 foto, maksimum 20 foto
- Total maksimum: 60 foto per kunjungan (20 per fase)
- Template bisa override min/max via template_photo_requirements
- Ukuran per foto: maksimum 10 MB, format JPEG atau PNG
- Wajib dari kamera langsung (bukan galeri)
- GPS wajib aktif saat foto
- ALASAN batas 20/fase: mencegah pembengkakan storage R2
  dan memastikan kualitas lebih penting dari kuantitas

WATERMARK (burned ke gambar, tidak bisa dihapus):
Format di bagian bawah foto:
  Waktu   : Kamis, 03 Apr 2025 10:32:14 WITA
  Lat     : -6.175392  (6 angka desimal = presisi ~11cm)
  Lng     : 106.827153 (6 angka desimal)
  Kab     : Kab. Jakarta Selatan
  Prov    : DKI Jakarta
  Lokasi  : PT. Maju Bersama · Gedung B

Proses watermark:
1. Ambil foto via native camera (bukan galeri)
2. Capture GPS koordinat bersamaan (6 desimal)
3. Reverse geocoding → dapat kabupaten & provinsi
4. Render watermark ke bitmap via Canvas API
5. Upload ke Cloudflare R2 (original + watermarked + thumbnail)
6. Simpan metadata ke visit_photos

BERITA ACARA:
- Generate hanya jika minimum foto terpenuhi
- Nomor otomatis: BA-YYYY/MM/NNN (reset tiap bulan)
- Template Handlebars → render via Puppeteer → PDF
- Isi: kop perusahaan, info kunjungan, ringkasan, grid foto, TTD
- Tanda tangan:
  * Teknisi: TTD di layar HP (react-native-signature-canvas)
  * Klien: TTD di layar HP ATAU upload foto TTD fisik
- Setelah kedua TTD → is_locked = TRUE (tidak bisa diubah)
- Kirim PDF ke klien via WhatsApp + email
```

### 5.9 Prioritas Tugas — Perbedaan Treatment
```
TIGA LEVEL PRIORITAS:

┌──────────┬──────────────────┬──────────────────┬────────────────────────────┐
│ PRIORITAS│ NOTIFIKASI       │ DEADLINE KONFIRM │ AUTO-ASSIGN JIKA TIDAK     │
│          │                  │ TEKNISI          │ RESPONS                    │
├──────────┼──────────────────┼──────────────────┼────────────────────────────┤
│ normal   │ Push notif saja  │ 60 menit         │ Setelah 60 menit           │
│ high     │ Push + WA        │ 30 menit         │ Setelah 30 menit           │
│ urgent   │ Push + WA +      │ 15 menit         │ Setelah 15 menit           │
│          │ bunyi kritis     │                  │                            │
└──────────┴──────────────────┴──────────────────┴────────────────────────────┘

ESKALASI OTOMATIS (jika tugas tidak ditangani):
- Normal tidak ada teknisi 2 jam → eskalasi ke High, notif manajer
- High tidak ada teknisi 1 jam   → eskalasi ke Urgent, notif manajer + admin
- Urgent tidak ada teknisi 30 mnt → notif emergency contacts (WA langsung)

Saat eskalasi:
- tasks.escalated_from = prioritas lama
- tasks.escalated_at   = waktu eskalasi
- tasks.priority       = prioritas baru
- Notif manajer: "Tugas [nama] telah di-eskalasi dari [lama] ke [baru]"

VISUAL DI MOBILE PER PRIORITAS:
- normal : border glass tipis, tidak ada badge khusus
- high   : border oranye, badge "PENTING"
- urgent : border merah tebal, badge "MENDADAK" animasi blink,
           bunyi notif berbeda dari notif biasa

CRON: escalation-checker setiap 5 menit
- Cek semua tasks status pending/unassigned
- Bandingkan created_at dengan waktu sekarang
- Jika melewati threshold → eskalasi + kirim notif
```

### 5.10 Pending by Evidence — On Hold
```
DEFINISI:
Teknisi sudah di lokasi tapi pekerjaan tidak bisa diselesaikan
karena alasan valid yang dapat dibuktikan dengan foto.

ALASAN YANG VALID (dropdown pilihan teknisi):
- client_absent       : Klien / PIC tidak ada di lokasi
- access_denied       : Tidak bisa masuk gedung/area
- equipment_broken    : Peralatan teknisi rusak di lokasi
- material_unavailable: Spare part/material belum tersedia
- client_cancel       : Klien batalkan sepihak saat teknisi sudah tiba
- weather             : Cuaca ekstrem tidak memungkinkan bekerja
- technician_sick     : Teknisi sakit mendadak di lokasi
- other               : Alasan lain (wajib isi keterangan detail)

SYARAT PENGAJUAN ON HOLD:
1. Status visit harus 'ongoing' (teknisi sudah check-in di lokasi)
2. Wajib upload minimum 1 foto bukti (maksimum 5)
3. Wajib isi reason_type + reason_notes
4. GPS harus aktif saat submit (koordinat dicatat)

ALUR LENGKAP:

Teknisi di lokasi → tidak bisa kerja
        ↓
Buka screen kunjungan aktif
Tap tombol "Tunda Pekerjaan" (oranye, di bawah form)
        ↓
Form on-hold muncul:
- Dropdown: pilih alasan
- TextArea: keterangan detail (wajib)
- Kamera: foto bukti minimal 1 (wajib, dari kamera langsung)
- Catatan: foto bukti TIDAK perlu watermark GPS seperti foto kunjungan
        ↓
Submit → sistem:
- tasks.status  = 'on_hold'
- visits.status = 'on_hold'
- Buat record task_holds
- Set auto_approve_at:
  * Normal  → held_at + 4 jam
  * High    → held_at + 2 jam
  * Urgent  → held_at + 30 menit
- Notif WA + push ke manajer (SEGERA, tidak antri):
  "⏸ Tugas ditunda — [nama teknisi] tidak dapat menyelesaikan
   kunjungan di [nama klien].
   Alasan: [reason_type]
   [keterangan]
   📸 [jumlah] foto bukti tersedia
   Mohon review sebelum [auto_approve_at]"
        ↓
MANAJER REVIEW (batas waktu sesuai prioritas):
┌──────────────────────────────────────────────┐
│ A. APPROVE ON HOLD:                          │
│    - Pilih tanggal kunjungan ulang           │
│    - Pilih teknisi:                          │
│      * "Teknisi yang sama" (default)         │
│      * "Pilih teknisi lain" → dropdown       │
│      * "Biarkan terbuka" → broadcast ke dept │
│    - Isi instruksi tambahan (opsional)       │
│    - Submit → task status = 'rescheduled'    │
│    - Notif ke teknisi + klien (via WA)       │
├──────────────────────────────────────────────┤
│ B. REJECT ON HOLD:                           │
│    - Isi alasan penolakan (wajib)            │
│    - Submit → task status = 'ongoing'        │
│    - Notif ke teknisi:                       │
│      "Permintaan tunda ditolak: [alasan]     │
│       Lanjutkan pekerjaan."                  │
└──────────────────────────────────────────────┘

AUTO-APPROVE (jika manajer tidak respons):
Cron setiap 5 menit cek task_holds dengan:
- review_status = 'pending'
- NOW() >= auto_approve_at

Jika terlewat:
- Approved otomatis
- reschedule_date = held_at + 1 hari kerja
- rescheduled_assign_to = held_by (teknisi yang sama)
- task_holds.is_auto_approved = TRUE
- Notif manajer: "On-hold auto-diapprove karena tidak ada respons"
- Notif teknisi: "Kunjungan dijadwalkan ulang besok"

SETELAH RESCHEDULE — TEKNISI IN-CHARGE:
Jika manajer pilih "Teknisi yang sama":
  → task.assigned_to tetap teknisi lama
  → Teknisi langsung lihat tugas di jadwal tanggal baru
  → Bisa langsung mulai kunjungan (tidak perlu konfirmasi ulang)

Jika manajer pilih "Teknisi lain":
  → task.assigned_to = teknisi baru
  → Teknisi baru dapat notif dan perlu konfirmasi
  → Alur normal (terima/tolak dalam batas waktu)

Jika manajer pilih "Biarkan terbuka":
  → task.assigned_to = NULL, status = 'unassigned'
  → Broadcast ke seluruh tim departemen
  → Siapa terima pertama → terkunci

LAPORAN ON HOLD:
- Dashboard web: tabel semua task on_hold + rescheduled
- Filter: tanggal, teknisi, klien, alasan, status review
- Export Excel untuk analisis: penyebab terbanyak penundaan
```

### 5.11 Dispatch & Delegasi
```
PEKERJAAN MENDADAK — ALUR DISTRIBUSI:
1. Manajer buat tiket task (priority: normal|high|urgent)
2. Pilih dispatch_type:
   a. DIRECT: assign ke teknisi tertentu
      - Notif langsung ke teknisi
      - Set confirm_deadline (default 30 menit)
   b. BROADCAST: kirim ke semua anggota tim/dept
      - Siapa confirm pertama → task dikunci untuknya
      - Set confirm_deadline yang sama

3. Teknisi terima/tolak:
   a. TERIMA → status = 'assigned', klien dapat notif
   b. TOLAK → sistem cari pengganti berdasarkan:
      - Tidak sedang dalam kunjungan aktif
      - Lokasi terdekat dari task
   c. TIDAK RESPONS setelah deadline:
      → auto-assign ke teknisi terbaik tersedia
      → notif manajer

DELEGASI (hanya senior → junior, butuh approval manajer):

Skenario A — Tugas BELUM dimulai:
1. Senior buka task → pilih "Delegasi"
2. Pilih teknisi junior (hanya yang sedang bebas)
3. Wajib isi alasan
4. Sistem notif manajer
5. Manajer approve/tolak dalam 2 jam
   - Jika tidak respons 2 jam → auto-reject, task kembali ke senior
6. Jika approve → task pindah ke junior, notif kedua pihak

Skenario B — Kunjungan SUDAH BERJALAN (darurat/emergency):
1. Senior sudah di lokasi tapi ada situasi darurat
   (harus pergi, sakit mendadak, darurat keluarga)
2. Senior buka kunjungan aktif → pilih "Handover Kunjungan"
3. Pilih junior yang available + wajib isi alasan darurat
4. Manajer bisa OVERRIDE langsung tanpa perlu approval
   (karena situasi darurat, kunjungan tidak boleh terhenti)
5. Foto dan form yang sudah diisi senior TERSIMPAN dan dilanjutkan junior
6. Junior menerima notif: "Handover dari [senior]. Lanjutkan dari foto ke-[N]"
7. Junior check-in ulang di lokasi yang sama
8. Di BA final: tercatat "Dikerjakan oleh: [senior] (s/d [waktu]) + [junior]"

CATATAN PENTING delegasi skenario B:
- Manajer tetap dinotif tapi tidak perlu approve (situasi darurat)
- Data kunjungan (foto, form) tidak hilang saat handover
- Audit trail mencatat pergantian teknisi di tengah kunjungan

SWAP JADWAL (dua teknisi saling tukar):
1. Teknisi A kirim permintaan swap ke Teknisi B
2. Teknisi B terima/tolak
3. Jika setuju → kirim ke manajer untuk approval
4. Manajer approve → jadwal keduanya berubah otomatis
5. Audit trail: setiap langkah dicatat di audit_logs

AUDIT TRAIL:
- Setiap perubahan assign, delegasi, swap dicatat di audit_logs
- Field: who (user_id), what (action), when (created_at), before/after (old_data/new_data)

HAK AKSES:
- Manager  : semua aksi, override kapanpun
- Senior   : terima/tolak, delegasi ke junior (butuh approval)
- Junior   : terima/tolak saja, swap (butuh approval)
```

### 5.12 Notifikasi — Multi Channel
```
CHANNEL & PRIORITAS:
1. Push Notification (FCM) → semua notif in-app
2. WhatsApp (whatsapp-web.js) → notif kritis: tugas mendadak, BA terbit, dll
3. Email (Resend.com) → notif non-urgent: rekap harian, laporan

RATE LIMITING WHATSAPP:
- Jeda minimum 2 detik antar pesan (cegah banned)
- Maksimum 100 pesan/jam dari satu nomor
- Queue via Bull + Redis

TEMPLATE NOTIF:
- Tugas mendadak: judul, lokasi, deadline konfirmasi, tombol Terima/Tolak
- BA terbit: link download PDF, nama klien, nomor BA
- Alfa terdeteksi: tanggal, warning potong cuti, deadline keberatan
- Cuti H-30/H-7: sisa saldo, tanggal hangus
```

---


---



## 6. API ENDPOINTS LENGKAP

```
AUTH
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
POST   /auth/forgot-password        ← kirim OTP 6 digit ke email atau WA
POST   /auth/verify-otp             ← verifikasi OTP, return reset_token
POST   /auth/reset-password         ← ganti password dengan reset_token
POST   /auth/change-password        ← ganti password saat must_change_password=true

USERS
GET    /users
POST   /users
GET    /users/:id
PATCH  /users/:id
POST   /users/:id/reset-pin            ← admin reset PIN absensi karyawan
POST   /auth/set-pin                   ← karyawan set PIN pertama kali (after first login)
POST   /auth/verify-pin                ← verifikasi PIN saat biometrik tidak tersedia

ATTENDANCE
POST   /attendance/check-in
POST   /attendance/check-out
GET    /attendance/today/:userId
GET    /attendance/history
GET    /attendance/report

SCHEDULE
GET    /schedules/:userId
GET    /schedules/team
POST   /schedules/shift-types
PATCH  /schedules/shift-types/:id
POST   /schedules/office-hours
GET    /schedules/config

VISITS
POST   /visits/check-in
POST   /visits/:id/photos
POST   /visits/:id/check-out
GET    /visits/:id
GET    /visits/history

SERVICE REPORTS
POST   /service-reports
POST   /service-reports/:id/sign-technician
POST   /service-reports/:id/sign-client
POST   /service-reports/:id/generate-pdf
GET    /service-reports/:id

TASKS
GET    /tasks
POST   /tasks
POST   /tasks/:id/assign
POST   /tasks/:id/accept
POST   /tasks/:id/reject
POST   /tasks/:id/delegate
POST   /tasks/:id/handover             ← delegasi darurat saat kunjungan berjalan
POST   /tasks/:id/swap-request
POST   /tasks/:id/hold                 ← teknisi ajukan on_hold dengan bukti
GET    /tasks/:id/holds                ← riwayat on_hold satu tugas
POST   /tasks/:id/holds/:holdId/approve ← manajer approve + set reschedule
POST   /tasks/:id/holds/:holdId/reject  ← manajer reject on_hold
GET    /tasks/on-hold                  ← semua tugas on_hold (dashboard manajer)
GET    /tasks/rescheduled              ← semua tugas rescheduled

LEAVE
GET    /leave/balance/:userId
POST   /leave/requests
PATCH  /leave/requests/:id/approve
GET    /leave/objections
POST   /leave/objections/:id/review

WARNING LETTERS (Surat Peringatan)
GET    /warning-letters                  ← list semua SP (admin/HR)
POST   /warning-letters                  ← buat SP baru
GET    /warning-letters/user/:userId     ← riwayat SP karyawan tertentu
GET    /warning-letters/:id              ← detail SP
POST   /warning-letters/:id/acknowledge ← karyawan acknowledge (TTD digital)
GET    /warning-letters/:id/pdf          ← download PDF SP

REPORTS
GET    /reports/attendance?month=&dept=
GET    /reports/visits?month=&userId=
GET    /reports/leave?year=&userId=
GET    /reports/overtime?month=&dept=   ← rekap lembur per karyawan per bulan
GET    /reports/export/excel
GET    /reports/export/pdf
GET    /reports/overtime/export/excel   ← export rekap lembur untuk payroll HR

MONITORING (WebSocket events)
Event: 'technician:location' → update posisi GPS
Event: 'task:updated'        → update status tugas
Event: 'notification:new'    → notif baru
```

---


---

## 7. CRON JOBS LENGKAP

```
ABSENSI & JADWAL:
auto-checkout          : setiap menit          → auto CO di jam shift_end
alfa-detector          : setiap hari, shift_end+30m → deteksi alfa per shift
pending-deduction      : setiap jam            → eksekusi deduction deadline habis
schedule-generator     : setiap hari 23:00     → generate jadwal office hours besok

CUTI & SALDO:
leave-accrual          : tgl 1 tiap bulan 00:01 → +1 hari saldo semua karyawan aktif
leave-expiry           : 31 Des 23:55          → hanguskan semua saldo
leave-expiry-reminder  : setiap hari 08:00     → cek H-30 & H-7 sebelum 31 Des
collective-leave-check : setiap hari 00:01     → potong saldo jika besok cuti bersama

TUGAS & DISPATCH:
auto-assign            : setiap 30 detik       → cek tugas timeout konfirmasi
sla-monitor            : setiap 15 menit       → cek SLA klien hampir terlewat
escalation-checker     : setiap 5 menit        → eskalasi prioritas tugas yang tidak ditangani
hold-auto-approver     : setiap 5 menit        → auto-approve on_hold yang melewati batas review

NOTIFIKASI:
announcement-expiry    : setiap hari 01:00     → nonaktifkan pengumuman kadaluarsa

BACKUP:
backup-full            : setiap hari 02:00 WITA       → pg_dump + encrypt + R2
backup-incremental     : 08:00, 14:00, 20:00 WITA     → incremental backup
backup-cleanup         : setiap hari 03:00 WITA       → hapus backup > 30 hari
backup-verify          : setiap Minggu 03:00 WITA     → restore test + validasi

SURAT PERINGATAN:
sp-reminder            : setiap hari 08:00     → notif HR jika violations karyawan
                                                  capai threshold SP (3/5/7 kali)
```

---


---

## 8. ENVIRONMENT VARIABLES

```env
# App
NODE_ENV=development
APP_PORT=3000
APP_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3001

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nustech-attendenx
DB_USER=postgres
DB_PASS=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASS=

# JWT
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# AWS (hanya untuk Cloudflare R2 storage, bukan Rekognition)
# AWS Rekognition DIHAPUS — biometrik menggunakan sensor HP lokal
# R2 menggunakan protokol S3-compatible, bukan AWS langsung

# Biometrik (tidak butuh env variable — proses di device)
# expo-local-authentication handle semuanya di sisi HP karyawan
# PIN fallback disimpan sebagai bcrypt hash di tabel users.pin_hash

# Google Maps (hanya untuk deep link navigasi, TIDAK perlu API key)
# Deep link format: https://maps.google.com/?q=LAT,LNG&navigate=yes

# OSRM Routing (public API, GRATIS, tidak perlu API key)
OSRM_API_URL=http://router.project-osrm.org/route/v1
OSRM_PROFILE=driving

# Nominatim Reverse Geocoding (OpenStreetMap, GRATIS, tidak perlu key)
NOMINATIM_API_URL=https://nominatim.openstreetmap.org
NOMINATIM_USER_AGENT=NustechAttendenX/1.0
NOMINATIM_CACHE_TTL_DAYS=30

# Leaflet / OpenStreetMap (tidak perlu API key, tiles gratis)
OSM_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
# Opsional: Maptiler free tier untuk tile lebih cepat
# MAPTILER_KEY=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=nustech-attendenx-storage
R2_PUBLIC_URL=

# Firebase (FCM)
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=

# WhatsApp (whatsapp-web.js)
WA_SESSION_PATH=./wa-session
WA_RATE_LIMIT_PER_HOUR=100
WA_MIN_DELAY_MS=2000

# Resend (Email)
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@nustech-attendenx.id

# Company
COMPANY_NAME=
COMPANY_LOGO_URL=

# Sentry
SENTRY_DSN=

# SOS Alert
SOS_TRACK_INTERVAL_SEC=15
SOS_CONTACT_NOTIFY_ALL=true

# Expense Claims
EXPENSE_MAX_RECEIPT_SIZE_MB=10

# App Config
APP_TIMEZONE=Asia/Makassar

# Backup & Restore (enkripsi AES-256 sebelum upload ke R2)
BACKUP_ENCRYPTION_KEY=   # 64 hex chars (256-bit key) — generate: openssl rand -hex 32
BACKUP_IV=               # 32 hex chars (128-bit IV)  — generate: openssl rand -hex 16
BACKUP_RETENTION_DAYS=30
BACKUP_NOTIFY_EMAIL=admin@nustech.id
BACKUP_R2_PATH=backups/
APP_LOCALE=id-ID
APP_CURRENCY=IDR
```

---


---

## 9. INFRASTRUKTUR & DEPLOYMENT

### 9.1 Docker Compose Production (VPS + Traefik)



```yaml
# docker-compose.prod.yml
# Deploy di VPS 76.13.23.42 yang sudah ada Docker + Traefik

version: '3.8'

networks:
  traefik_network:
    external: true   # network Traefik yang sudah ada di VPS
  internal:
    internal: true   # network internal antar service

services:

  # ─── BACKEND NestJS ───────────────────────────────────
  backend:
    image: nustech-attendenx-backend:latest
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    env_file:
      - ./backend/.env.production
    volumes:
      - ./backend/wa-session:/app/wa-session   # WhatsApp session persist
    networks:
      - traefik_network
      - internal
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=Host(`api.nustech-attendenx.id`)"
      - "traefik.http.routers.backend.tls=true"
      - "traefik.http.routers.backend.tls.certresolver=le"
      - "traefik.http.services.backend.loadbalancer.server.port=3000"
    depends_on:
      - postgres
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ─── WEB NEXT.JS ──────────────────────────────────────
  web:
    image: nustech-attendenx-web:latest
    build:
      context: ./apps/web
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file:
      - ./apps/web/.env.production
    networks:
      - traefik_network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.web.rule=Host(`app.nustech-attendenx.id`)"
      - "traefik.http.routers.web.tls=true"
      - "traefik.http.routers.web.tls.certresolver=le"
      - "traefik.http.services.web.loadbalancer.server.port=3001"
    depends_on:
      - backend

  # ─── POSTGRESQL ───────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: nustech_attendenx
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASS}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/database/init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - internal
    # TIDAK expose ke luar (internal only, Traefik tidak routing DB)

  # ─── REDIS ────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASS} --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - internal
    # TIDAK expose ke luar (internal only)

volumes:
  postgres_data:
  redis_data:
```

### 9.2 CI/CD — GitHub Actions untuk VPS

```yaml
# .github/workflows/deploy.yml
# Trigger: push ke branch main
# Target: VPS 76.13.23.42 via SSH

name: Deploy Nustech-AttendenX

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test --workspace=backend
      - run: npm run lint --workspace=backend

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy ke VPS via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}       # 76.13.23.42
          username: ${{ secrets.VPS_USER }}   # root
          key: ${{ secrets.SSH_PRIVATE_KEY }} # SSH private key
          script: |
            cd /opt/nustech-attendenx
            git pull origin main
            docker compose -f docker-compose.prod.yml build --no-cache
            docker compose -f docker-compose.prod.yml up -d
            docker image prune -f

      - name: Health Check
        run: |
          sleep 30
          curl -f https://api.nustech-attendenx.id/health || exit 1

      - name: Notif WA jika gagal
        if: failure()
        run: |
          curl -X POST ${{ secrets.WA_WEBHOOK_URL }}             -d "message=DEPLOY GAGAL: ${{ github.sha }}"

# GITHUB SECRETS yang harus diset:
# VPS_HOST         = 76.13.23.42
# VPS_USER         = root
# SSH_PRIVATE_KEY  = (isi dengan private key SSH)
# WA_WEBHOOK_URL   = (endpoint notif WA internal)
```

### 9.3 Subdomain yang Dibutuhkan
```
api.nustech-attendenx.id   → Backend NestJS
app.nustech-attendenx.id   → Web Dashboard Next.js
```



### 9.4 Struktur Folder Deployment
```
nustech-attendenx/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── backend/
│   └── Dockerfile
├── apps/
│   └── web/
│       └── Dockerfile
├── docker-compose.prod.yml
└── package.json (workspaces)
```


---



## 10. UI LAYOUT SPEC — MOBILE APP (iOS 26 Liquid Glass · Bento Grid · Dual Mode)

> Spec wajib untuk SEMUA screen mobile. Agent HARUS mengikuti layout dan elemen persis seperti di bawah.
>
> LIGHT MODE (Opsi B) — default, untuk kerja siang/lapangan:
>   Background: #F2F2F7 solid · Card: solid tints (#EFF6FF, #F0FDF4, dll)
>   Tab bar & toolbar: Liquid Glass mengambang · Tombol: glass material
>
> DARK MODE (Opsi A) — aktif saat sistem HP dark, untuk malam hari:
>   Background: wallpaper LinearGradient unik per screen
>   Card: Liquid Glass tembus (rgba + backdrop-filter)
>   Tab bar & toolbar: Liquid Glass mengambang (sama dengan light)
>
> Implementasi: useColorScheme() → 'light' | 'dark'
> Mode otomatis mengikuti setting sistem HP karyawan

---

### 10.1 Aturan Global Mobile — iOS 26 Liquid Glass

```
STRUKTUR SETIAP SCREEN:
┌─────────────────────────────────────┐
│ Dynamic Island (hitam, tengah atas) │  ← 82×20px (light) / 88×22px (dark)
│ Status Bar — jam kiri, ikon kanan   │  ← abu (light) / putih (dark)
├─────────────────────────────────────┤
│ ┌───────────────────────────────┐   │
│ │ TOOLBAR GLASS (mengambang)    │   │  ← BlurView pill, margin 0 10px 8px
│ │ judul screen kiri + aksi kanan│   │    border-radius: 16px
│ └───────────────────────────────┘   │
│                                     │
│  KONTEN SCREEN (ScrollView)         │  ← padding 10px kiri-kanan
│  • LIGHT: card #fff solid + shadow  │
│  • DARK : card glass rgba + blur    │
│                                     │
└─────────────────────────────────────┘
│ ┌───────────────────────────────┐   │
│ │ TAB BAR GLASS (mengambang)    │   │  ← BlurView bubble
│ │ 5 tab · pill · border-r 26px  │   │    margin: 6px 10px 10px
│ └───────────────────────────────┘   │
└─────────────────────────────────────┘

TAB BAR (5 tab, kiri ke kanan):
  1. Beranda   2. Tugas   3. Jadwal   4. Kunjungan   5. Profil

Tab aktif  : ikon #007AFF + dot biru kecil + label Inter 700 7px
Tab inaktif: ikon #9CA3AF (light) / rgba(255,255,255,0.40) (dark)

SHRINK SAAT SCROLL:
  ↓ scroll: label sembunyi, hanya ikon (compact)
  ↑ scroll: label muncul kembali (expand, 200ms ease-out)

CARD — LIGHT MODE:
  Putih  : #FFFFFF, border 0.5px rgba(0,0,0,0.07), shadow 0 1px 4px rgba(0,0,0,0.06)
  Biru   : #EFF6FF, border #BFDBFE
  Hijau  : #F0FDF4, border #BBF7D0
  Oranye : #FFF7ED, border #FED7AA
  Merah  : #FEF2F2, border #FECACA
  Ungu   : #F5F3FF, border #DDD6FE
  Teal   : #ECFEFF, border #A5F3FC
  Kuning : #FEFCE8, border #FDE68A
  border-radius: 14px, padding: 10px 12px

CARD — DARK MODE (semua pakai glass):
  Default: rgba(255,255,255,0.10), border rgba(255,255,255,0.18), blur(20px)
  Biru   : rgba(0,122,255,0.20),   border rgba(0,122,255,0.40)
  Hijau  : rgba(52,199,89,0.16),   border rgba(52,199,89,0.35)
  Oranye : rgba(255,159,10,0.16),  border rgba(255,159,10,0.35)
  Merah  : rgba(255,69,58,0.16),   border rgba(255,69,58,0.35)
  Ungu   : rgba(191,90,242,0.16),  border rgba(191,90,242,0.35)
  specular: inset 0 1px 0 rgba(255,255,255,0.18)

FAB (Floating Action Button) — tombol utama:
  LIGHT: background rgba(0,122,255,0.90), border rgba(0,122,255,0.60)
         backdrop-filter blur(12px), specular inset 0 1px 0 rgba(255,255,255,0.35)
  DARK : background rgba(0,122,255,0.80), specular inset 0 1px 0 rgba(255,255,255,0.28)
  KEDUANYA: height 48px, border-radius 14px, font Inter 700 15px white

TOMBOL SEKUNDER:
  LIGHT: rgba(255,255,255,0.85), border rgba(0,0,0,0.10), color #374151
  DARK : rgba(255,255,255,0.12), border rgba(255,255,255,0.20), color rgba(255,255,255,0.80)

TOMBOL DESTRUKTIF:
  LIGHT: #FEF2F2, border #FECACA, color #DC2626
  DARK : rgba(255,69,58,0.20), border rgba(255,69,58,0.40), color #FCA5A5

TOMBOL ON-HOLD (Tunda Pekerjaan):
  LIGHT: #FFF7ED, border #FED7AA, color #C2410C, backdrop-filter blur(10px)
  DARK : rgba(255,159,10,0.18), border rgba(255,159,10,0.40), color #FCD34D

PILL BADGE:
  LIGHT: background tint solid, text warna gelap sesuai warna
         Contoh: blue = bg #DBEAFE text #1D4ED8
  DARK : background rgba tinted, text warna terang
         Contoh: blue = bg rgba(0,122,255,0.35) text #7DD3FC

TEKS:
  LIGHT: primary #111111, secondary #6B7280, tertiary #9CA3AF
  DARK : primary #FFFFFF,  secondary rgba(255,255,255,0.65), tertiary rgba(255,255,255,0.40)
```

---

### M-01 · SCREEN LOGIN

```
LAYOUT (tidak ada toolbar & tab bar):
┌─────────────────────────────────────┐
│ Dynamic Island                      │
│                                     │
│   [LOGO 44px — glass bubble]        │  ← light: EFF6FF+border BFDBFE
│   "Nustech-AttendenX" — 14px 700    │     dark: rgba(0,122,255,0.25)+blur
│   "Masuk ke akun Anda" — secondary  │
│                                     │
│   ┌─────────────────────────────┐   │
│   │ Email                       │   │  ← input glass
│   └─────────────────────────────┘   │
│   ┌─────────────────────────────┐   │
│   │ Password ···             👁 │   │  ← toggle show/hide
│   └─────────────────────────────┘   │
│                                     │
│   [       MASUK       ]             │  ← FAB full-width, biru
│                                     │
│   Lupa password?                    │  ← link kecil tengah, #007AFF
│                                     │
└─────────────────────────────────────┘

BACKGROUND:
  LIGHT: LinearGradient(170deg, #f0f4ff, #f7f0ff, #f0fff4) — subtle
  DARK : LinearGradient(160deg, #0d1b3e, #1a0d3e, #0d3e2d)

INPUT GLASS:
  LIGHT: rgba(255,255,255,0.85), border rgba(0,0,0,0.10), blur(8px)
  DARK : rgba(255,255,255,0.10), border rgba(255,255,255,0.20), blur(12px)
  border-radius: 12px, padding: 9px 11px

VALIDASI:
  Email kosong → border merah + teks "Email wajib diisi"
  Password < 6 → "Password minimal 6 karakter"
  Error server → toast merah di atas: "Email atau password salah"
  Loading → spinner di dalam tombol, tombol disabled

SETELAH LOGIN → must_change_password=TRUE → Screen Ganti Password
SETELAH LOGIN → normal → M-02 Beranda
```

---

### M-02 · SCREEN BERANDA (Bento Grid Utama)

```
LAYOUT:
┌─────────────────────────────────────┐
│ Dynamic Island                      │
│ Status Bar: "9:41"         ●●● ▌   │
├─────────────────────────────────────┤
│ ┌───────────────────────────────┐   │
│ │ "Selamat pagi, [Nama]"  [AF]  │   │  ← toolbar glass
│ │ "Kamis, 03 Apr 2025"          │   │    AF = avatar inisial kanan
│ └───────────────────────────────┘   │
│                                     │
│ BENTO GRID (2 kol, gap 8px):        │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ STATUS KEHADIRAN (full width)   │ │  ← card biru
│ │ "Hadir"      [●] Check-in 08:02│ │
│ │ ████████████░░░░░░░░░░░░░░░░░░ │ │  ← progress bar shift
│ │  08:00       Sekarang     17:00│ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌──────────────┐ ┌──────────────┐   │
│ │ TUGAS HARI   │ │ KUNJUNGAN    │   │  ← card hijau | oranye
│ │ INI    [3]   │ │ BULAN INI[14]│   │    angka: Inter 700 22px
│ │ 1 selesai    │ │ Target: 20   │   │
│ └──────────────┘ └──────────────┘   │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ TUGAS BERIKUTNYA (full width)   │ │  ← card putih (light) / glass (dark)
│ │ Maintenance AC – Gd B           │ │
│ │ PT. Maju Bersama · 10:30 WITA   │ │
│ │ [badge: MENDADAK]               │ │
│ │ [ MULAI KUNJUNGAN → ]           │ │  ← FAB biru
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [!] DARURAT / SOS (full width)  │ │  ← card merah tipis
│ │ "Tahan 3 detik untuk aktifkan"  │ │    SELALU tampil
│ └─────────────────────────────────┘ │
│                                     │
│ ┌──────────────┐ ┌──────────────┐   │
│ │ SALDO CUTI   │ │ KLAIM BIAYA  │   │  ← card ungu | teal
│ │ "8 hari"     │ │ "2 pending"  │   │
│ │ sisa 2025    │ │ Lihat →      │   │
│ └──────────────┘ └──────────────┘   │
│                                     │
│ [DELEGASI MASUK — CONDITIONAL]      │  ← full width, card merah
│ hanya muncul jika ada request       │    [TERIMA] [TOLAK] inline
│                                     │
└─────────────────────────────────────┘
│ ┌─── TAB BAR GLASS MENGAMBANG ───┐  │
│ │ Beranda Tugas Jadwal Kvnjgn Profil│
│ └────────────────────────────────┘  │

BACKGROUND:
  LIGHT: #F2F2F7
  DARK : LinearGradient(145deg, #1a3a6b, #0d4f8a, #1a6b4a, #2d1b6b)

URUTAN BENTO (prioritas dari atas):
  1. Status kehadiran — selalu show
  2. Tugas hari ini + Kunjungan bulan ini — 2 kolom
  3. Tugas berikutnya — selalu show (jika tidak ada: "Tidak ada tugas hari ini")
  4. Tombol SOS — selalu show
  5. Saldo cuti + Klaim biaya — 2 kolom
  6. Delegasi masuk — conditional

KONDISI KHUSUS — Saat dalam shift aktif (sudah check-in):
  Ganti card "Tugas Berikutnya" dengan card checkout countdown:
  ┌─────────────────────────────────┐
  │ CHECK-OUT                       │  ← card oranye/kuning
  │ Tersedia pukul 16:02 WITA       │
  │ 5j 23m 10d  ← countdown besar  │  ← Inter 700 22px #D97706
  │ [ CHECKOUT ] ← disabled / aktif │
  └─────────────────────────────────┘
```

---

### M-03 · SCREEN JADWAL

```
LAYOUT:
┌─────────────────────────────────────┐
│ ┌───────────────────────────────┐   │
│ │ "Jadwal Saya"     Apr 2025    │   │  ← toolbar glass
│ └───────────────────────────────┘   │
│                                     │
│ [Mingguan] [Bulanan] [Agenda]        │  ← segmented control
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ‹  Minggu 31 Mar – 6 Apr  ›    │ │  ← card putih/glass
│ │ S  S  R  K  J  S  M            │ │
│ │ 31 1  2 [3] 4  5  6            │ │  ← [3]=today, circle biru
│ │ ●  ●● ● ●●● ●  ·  ·           │ │  ← dot events per hari
│ └─────────────────────────────────┘ │
│                                     │
│ DETAIL HARI INI (Kamis 3 Apr):      │
│ ┌─────────────────────────────────┐ │
│ │ [●biru] Shift Pagi              │ │  ← card biru
│ │ 08:00 – 16:00 · Kantor Pusat    │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ [●oranye] Maintenance AC        │ │  ← card oranye
│ │ 10:30 · PT. Maju Bersama        │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ [●ungu] Piket On-Call           │ │  ← card ungu
│ │ 17:00 – 21:00                   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ LEGENDA: ● Shift  ● Kunjungan  ● Piket │
│                                     │
└─────────────────────────────────────┘
│ TAB BAR GLASS (Jadwal aktif)        │

BACKGROUND: LIGHT #F2F2F7 | DARK linear(135deg,#1b3a5c,#0d3e1a,#3e1b0d)
READ ONLY — tidak ada tombol tambah/edit
```

---

### M-04 · SCREEN TUGAS & DISPATCH

```
LAYOUT:
┌─────────────────────────────────────┐
│ ┌───────────────────────────────┐   │
│ │ "Tugas Hari Ini"   [2 konfirm]│   │  ← toolbar glass
│ └───────────────────────────────┘   │  ← badge merah jumlah perlu konfirmasi
│                                     │
│ SECTION: AKTIF                      │  ← label 7px uppercase abu
│ ┌─────────────────────────────────┐ │
│ │ [border biru 1.5px]             │ │  ← card highlight aktif
│ │ Maintenance AC – Gedung B       │ │
│ │ PT. Maju Bersama · Berjalan     │ │
│ │ [MINI MAP: pin biru → pin merah]│ │  ← map mock 52px
│ │ 3.2 km · ~12 menit             │ │
│ │ [ MULAI NAVIGASI → ]            │ │  ← FAB biru
│ └─────────────────────────────────┘ │
│                                     │
│ SECTION: KONFIRMASI                 │
│ ┌─────────────────────────────────┐ │
│ │ [badge MENDADAK merah]          │ │  ← card merah
│ │ Maintenance Genset              │ │
│ │ PT. Sinar Abadi · Urgent        │ │
│ │ Konfirmasi dalam: 23:45         │ │  ← countdown #F59E0B
│ │ [ TERIMA ] [ TOLAK ]            │ │  ← 2 FAB sejajar
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ [PENTING] [Rescheduled]         │ │  ← card oranye
│ │ Instalasi CCTV – High           │ │
│ │ PT. Karya Utama · Dijadwal ulang│ │
│ │ [ KONFIRMASI HADIR ]            │ │
│ └─────────────────────────────────┘ │
│                                     │
│ SECTION: SELESAI                    │
│ ┌─────────────────────────────────┐ │
│ │ ✓ Inspeksi Panel Lt.2 · Selesai │ │  ← card hijau, opacity 80%
│ │ BA-2025/04/001 · 18 foto        │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
│ TAB BAR GLASS (Tugas aktif)         │

BACKGROUND: LIGHT #F2F2F7 | DARK linear(150deg,#2d0d3e,#0d2d4f,#1a3e0d)

SAAT TOLAK TUGAS → bottom sheet naik (glass overlay):
  "Alasan menolak?"
  [TextInput multiline]
  [ KIRIM PENOLAKAN ]
  [ Batal ]
```

---

### M-05 · SCREEN KUNJUNGAN (List & Detail Aktif)

```
LIST KUNJUNGAN:
┌─────────────────────────────────────┐
│ ┌───────────────────────────────┐   │
│ │ "Kunjungan"    [Filter▼]      │   │  ← toolbar glass
│ └───────────────────────────────┘   │
│ ┌─────────────────────────────────┐ │
│ │ [Berjalan] PT. Maju Bersama    │ │  ← card biru, border kiri tebal
│ │ Check-in 10:32 · 1j 24m lalu   │ │
│ │ 8/16 foto · Gedung B           │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ [Selesai] PT. Karya Utama      │ │  ← card hijau, opacity 80%
│ │ BA-2025/04/001 · 3 Apr         │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘

DETAIL KUNJUNGAN AKTIF (M-05b — tap card):
┌─────────────────────────────────────┐
│ ┌───────────────────────────────┐   │
│ │ "Maintenance AC" [●Berjalan]  │   │  ← toolbar glass
│ │ PT. Maju Bersama              │   │
│ └───────────────────────────────┘   │
│                                     │
│ ┌──────────────┐ ┌──────────────┐   │
│ │ DURASI       │ │ FOTO         │   │  ← 2 card kecil
│ │ "1j 24m"     │ │ 8/16 min     │   │
│ │ timer aktif  │ │ ████░░░░ 50% │   │
│ └──────────────┘ └──────────────┘   │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ SEBELUM  │  PROSES  │  SESUDAH  │ │  ← grid foto 3x3
│ │ [S1][S2] │ [P1][P2] │ [ ][ ]   │ │    terisi = biru
│ │ [S3][ + ] [P3][ + ] │ [ ][ + ] │ │    kosong = dashed + icon +
│ │ 5/5 ✓    │  3/6     │  0/5     │ │    progress per fase
│ └─────────────────────────────────┘ │
│                                     │
│ FORM TEMPLATE (sesuai template BA): │
│ [field dinamis sesuai template]     │  ← render dari template_fields
│                                     │
│ TANDA TANGAN:                       │
│ ┌──────────────┐ ┌──────────────┐   │
│ │ Teknisi TTD  │ │ Klien TTD    │   │  ← area TTD dashed
│ │ [canvas]     │ │ [canvas]     │   │
│ └──────────────┘ └──────────────┘   │
│                                     │
│ [ SELESAIKAN & TERBITKAN BA ]       │  ← FAB biru (disabled jika syarat blm)
│                                     │
│ [ ⏸ TUNDA PEKERJAAN ]              │  ← tombol on-hold oranye
│                                     │
└─────────────────────────────────────┘
│ TAB BAR GLASS (Kunjungan aktif)     │

BACKGROUND: LIGHT #F2F2F7 | DARK linear(140deg,#0d3e3e,#1a0d4f,#3e2d0d)

VALIDASI SELESAIKAN:
  disabled jika: foto < minimum, TTD kosong, form required belum diisi
  Tooltip: "Lengkapi foto (8/16) dan tanda tangan terlebih dahulu"
```

---

### M-06 · SCREEN ABSENSI KANTOR (Check-in / Check-out)

```
LAYOUT:
┌─────────────────────────────────────┐
│ ┌───────────────────────────────┐   │
│ │ "Absensi Kantor"              │   │  ← toolbar glass (tidak ada aksi kanan)
│ │ Kamis, 03 Apr 2025            │   │
│ └───────────────────────────────┘   │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ STATUS HARI INI          oranye │ │  ← card oranye jika belum check-in
│ │ Belum check-in                  │ │    card biru jika sudah hadir
│ │ Shift Pagi · 08:00 – 16:00     │ │    card hijau jika sudah checkout
│ │ Toleransi s/d 09:00 WITA       │ │
│ │ Lokasi: Kantor Pusat            │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [ikon kunci — glass bubble]     │ │  ← lock-card glass
│ │ Face ID / Fingerprint           │ │    LIGHT: rgba(255,255,255,0.85)+blur
│ │ "Verifikasi identitas           │ │    DARK : rgba(255,255,255,0.12)+blur
│ │  untuk check-in kantor"         │ │
│ │                                 │ │
│ │ [ VERIFIKASI SEKARANG ]         │ │  ← FAB biru
│ │ Tidak bisa? Gunakan PIN 6 digit │ │  ← link kecil biru bawah
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ● Kantor Pusat · Dalam radius   │ │  ← card hijau GPS ok
│ │ GPS aktif · Siap check-in       │ │
│ └─────────────────────────────────┘ │
│ ATAU                                │
│ ┌─────────────────────────────────┐ │
│ │ ⚠ 450m dari lokasi kantor       │ │  ← card oranye GPS di luar
│ │ [Scan QR] [Konfirmasi Alasan]   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ CHECK-OUT                kuning │ │  ← card kuning/oranye
│ │ Tersedia pukul: 16:02 WITA      │ │
│ │      5j 23m 10d ← countdown    │ │  ← Inter 700 18px warna amber
│ │ [ CHECKOUT ] ← disabled/aktif  │ │  ← disabled abu jika blm waktunya
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
│ TAB BAR GLASS                       │

BACKGROUND: LIGHT #F2F2F7 | DARK linear(155deg,#0d1f3e,#1a3e1a,#3e0d1f)

SETELAH CHECK-IN BERHASIL:
  Card status berubah → biru "Hadir · 08:02 WITA"
  Card checkout countdown aktif dengan timer berjalan
  Push notif: "Check-in berhasil pukul 08:02 WITA"

SETELAH CHECKOUT:
  Card status → hijau "Selesai · 08:02 – 16:05 · 8j 3m"
  Tombol checkout berubah jadi disabled "Sudah checkout"
```

---

### M-07 · SCREEN PROFIL & CUTI

```
LAYOUT:
┌─────────────────────────────────────┐
│ ┌───────────────────────────────┐   │
│ │ [Avatar 34px] Ahmad Fauzi     │   │  ← toolbar glass, avatar kiri
│ │ Teknisi Senior · EMP-001      │   │
│ └───────────────────────────────┘   │
│                                     │
│ ┌──────────────┐ ┌──────────────┐   │
│ │ SALDO CUTI   │ │ KEHADIRAN    │   │  ← ungu | hijau
│ │ "8 hari"     │ │ "95%"        │   │
│ │ sisa 2025    │ │ bulan ini    │   │
│ └──────────────┘ └──────────────┘   │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ BREAKDOWN CUTI (full width)     │ │
│ │ Akrual:          +10 hari  hijau│ │
│ │ Kompensasi libur: +1 hari  hijau│ │
│ │ Digunakan:        -3 hari  merah│ │
│ │ ████████████░░░░ bar ungu 67%   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [ AJUKAN CUTI / IZIN ]              │  ← FAB biru
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ RIWAYAT CUTI                    │ │
│ │ 15 Jun · Cuti 3 hari [Approved] │ │
│ │ 10 Apr · Alfa → Keberatan ✓     │ │
│ │ 5  Apr · Kompensasi +1 hari     │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ HISTORI JADWAL                  │ │
│ │ 3 Apr · Shift Pagi → Siang      │ │
│ │ 1 Apr · Office Hours diupdate   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ KLAIM BIAYA TERBARU        teal │ │
│ │ 2 Apr · Transport Rp 85.000 ✓   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [ LOGOUT ]                          │  ← tombol destruktif merah
│                                     │
└─────────────────────────────────────┘
│ TAB BAR GLASS (Profil aktif)        │

BACKGROUND: LIGHT #F2F2F7 | DARK linear(145deg,#1f0d3e,#0d3e2d,#3e1f0d)
```

---

### M-08 · SCREEN KLAIM BIAYA

```
LAYOUT:
┌─────────────────────────────────────┐
│ ┌───────────────────────────────┐   │
│ │ "Klaim Biaya"       [+ Buat]  │   │  ← toolbar glass, FAB kecil kanan
│ └───────────────────────────────┘   │
│                                     │
│ [Semua] [Pending] [Selesai]         │  ← segmented control
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [PENDING]           KC-2025/001 │ │  ← card oranye
│ │ Transport · Rp 85.000           │ │
│ │ 2 Apr · PT. Maju Bersama        │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ [APPROVED]          KC-2025/002 │ │  ← card hijau
│ │ Parkir · Rp 25.000              │ │
│ │ 1 Apr                           │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ─── Form Buat Klaim Baru ──────── │
│                                     │
│ [Transport] [Parkir] [Material]     │  ← chip pill, biru jika dipilih
│ [Konsumsi] [Akomodasi] [Lainnya]    │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Rp 85.000                       │ │  ← input glass, numpad
│ └─────────────────────────────────┘ │
│ Batas kategori ini: Rp 500.000      │  ← caption abu di bawah input
│                                     │
│ Foto nota/struk (wajib > Rp 50rb): │
│ [foto1] [+ tambah]                  │  ← maks 5 foto, kamera langsung
│                                     │
│ Terkait kunjungan: (opsional)       │
│ [Dropdown tugas/kunjungan ▼]        │
│                                     │
│ [ AJUKAN KLAIM ]                    │  ← FAB biru, disabled jika blm lengkap
│                                     │
└─────────────────────────────────────┘
│ TAB BAR GLASS                       │

BACKGROUND: LIGHT #F2F2F7 | DARK linear(135deg,#0d2d3e,#2d0d3e,#0d3e1a)
```

---

### M-09 · SCREEN SOS AKTIF

```
LAYOUT (tidak ada tab bar saat SOS aktif — fullscreen darurat):
┌─────────────────────────────────────┐
│ Dynamic Island (merah — SOS state)  │
│                                     │
│        [!] — ikon pulse merah       │  ← circle 44px, glow merah
│         SOS AKTIF                   │  ← Inter 700 16px merah
│   "Bantuan sedang dikirim"          │  ← caption
│   "Manajer & kontak diberitahu"     │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ LOKASI SAAT INI          merah  │ │
│ │ Lat: -8.563291                  │ │
│ │ Lng: 115.087821                 │ │
│ │ Kab. Badung · Bali              │ │
│ │ Update: 15 detik lalu           │ │  ← real-time via WebSocket
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Diaktifkan: 14:32:08 WITA       │ │  ← card merah
│ │     00:03:24 ← durasi timer     │ │  ← Inter 700 20px merah
│ │ Baterai: 45%                    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [ HUBUNGI DARURAT ]                 │  ← FAB hijau — langsung call
│                                     │
│ [ BATALKAN SOS (tekan 2x) ]         │  ← tombol sekunder abu
│                                     │
└─────────────────────────────────────┘

BACKGROUND:
  LIGHT: #FFF5F5 (merah sangat terang)
  DARK : linear(160deg,#3e0d0d,#1f0000,#3e1a0d)

KONFIRMASI BATALKAN (bottom sheet glass):
  "Yakin ingin batalkan SOS?"
  "Pastikan Anda sudah aman."
  [ IYA, SAYA AMAN ] — hijau
  [ Kembali ] — abu

GPS TRACKING: kirim koordinat tiap 15 detik via WebSocket selama SOS aktif
```

---

### M-10 · SCREEN NOTIFIKASI & PENGUMUMAN

```
LAYOUT:
┌─────────────────────────────────────┐
│ ┌───────────────────────────────┐   │
│ │ "Notifikasi"  [Tandai semua ✓]│   │  ← toolbar glass
│ └───────────────────────────────┘   │
│                                     │
│ SECTION: BARU                       │  ← label abu uppercase
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [●merah] Pekerjaan mendadak     │ │  ← card merah, border kiri tebal
│ │ Maintenance Genset – Urgent     │ │    UNREAD = border kiri 2.5px
│ │ Konfirmasi dalam 15 menit       │ │
│ │ [ TERIMA ]  [ TOLAK ]     2m    │ │  ← FAB inline, timestamp kanan
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [●ungu] Delegasi disetujui      │ │  ← card ungu, border kiri ungu
│ │ Swap jadwal Riko ↔ Survei Gd C  │ │
│ │                            18m  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ SECTION: TADI                       │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [●hijau] Berita acara diterima  │ │  ← card default, opacity 80%
│ │ BA-2025/04/001 · PT. Karya      │ │    READ = opacity lebih rendah
│ │                              1j │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [●oranye] Alfa terdeteksi       │ │  ← card oranye
│ │ Kemarin tidak hadir             │ │
│ │ Keberatan s/d: 12:00 besok      │ │
│ │ [ AJUKAN KEBERATAN ]       2j   │ │  ← FAB inline oranye
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
│ TAB BAR GLASS                       │

BACKGROUND: LIGHT #F2F2F7 | DARK linear(140deg,#0d1a3e,#2d0d2d,#0d3e1a)

BADGE UNREAD: dot warna sesuai tipe notifikasi di kiri teks
READ state: opacity 0.75, dot abu
TIMESTAMP: kanan atas card, Inter 400 7px warna tertiary
```



## 11. UI LAYOUT SPEC — WEB APP ADMIN (Dashboard)

> Spec wajib untuk SEMUA halaman web admin.
> Tech: Next.js 14 App Router + Tailwind CSS + shadcn/ui
> Mode: Light only (web admin diakses di laptop/PC, tidak perlu dark mode)
> Minimum lebar layar: 1024px

---

### 11.1 Aturan Global Web

```
STRUKTUR LAYOUT UTAMA:
┌──────────────────────────────────────────────────┐
│  SIDEBAR (160px, fixed, bg #0f172a dark)         │
│  ┌────────────────────────────────────────────┐  │
│  │ Logo + nama app                            │  │
│  │ Nav items (dengan dot warna per kategori)  │  │
│  └────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────┤
│  TOPBAR (full width, h:40px, glass sticky)       │
│  Kiri: nama halaman aktif (font 12px 600)        │
│  Kanan: [CTA btn] [Export] [🔔badge] [Avatar]    │
├──────────────────────────────────────────────────┤
│  MAIN CONTENT (flex:1, bg:#F8FAFC, p:10px 12px) │
│  Konten halaman di sini                          │
└──────────────────────────────────────────────────┘

SIDEBAR (160px, #0f172a):
  Logo: "Nustech-AttendenX" 10px 700 putih
  Tagline: "Admin Dashboard" 7px abu

  Nav items (urutan wajib):
  ● Beranda           dot #007AFF
  ● Monitoring Live   dot #EF4444
    Absensi
    Kunjungan
    Berita Acara
    Dispatch & Tugas
    Laporan
  ─── divider ───
    Jadwal
    Karyawan
    Klaim Biaya
  ─── divider ───
    Pengaturan
  ● SOS & Darurat     dot #EF4444 (selalu di bawah)

  Item aktif: bg rgba(0,122,255,0.20), text #fff, border-right 2px #007AFF
  Item hover: text rgba(255,255,255,0.70)
  Item normal: text rgba(255,255,255,0.45), font-size 9px

TOPBAR (glass):
  bg: rgba(255,255,255,0.95), border-bottom 0.5px #E5E7EB
  backdrop-filter: blur(8px)
  height: 40px, padding: 0 14px

MAIN CONTENT:
  background: #F8FAFC
  padding: 10px 12px
  display: flex, flex-direction: column, gap: 8px

METRIC CARD:
  bg #fff, border 0.5px #E5E7EB, border-radius 8px, padding 8px 10px
  Label: 7px 600 #9CA3AF UPPERCASE letter-spacing .4px
  Nilai: 18–22px 700 #111
  Sub: 7px #9CA3AF
  Tinted: blue=#EFF6FF+#BFDBFE, green=#F0FDF4+#BBF7D0
          orange=#FFF7ED+#FED7AA, red=#FEF2F2+#FECACA

TABEL DATA:
  th: 7px 600 #9CA3AF UPPERCASE, border-bottom 0.5px #E5E7EB, bg #F9FAFB, sticky
  td: 8px #374151, border-bottom 0.5px #F3F4F6, height 40px
  tr hover: bg #F9FAFB
  border-radius card wrapping: 8px

PILL STATUS:
  blue   : bg #DBEAFE, color #1D4ED8
  green  : bg #DCFCE7, color #15803D
  orange : bg #FFEDD5, color #C2410C
  red    : bg #FEE2E2, color #DC2626
  purple : bg #EDE9FE, color #6D28D9
  gray   : bg #F3F4F6, color #6B7280
  font-size: 7px, font-weight: 600, padding: 1px 6px, border-radius: 99px

TOMBOL:
  Primary (CTA): bg #007AFF, text #fff, border-radius 6px, padding 4px 10px, 9px 600
  Ghost: bg #F1F5F9, text #374151, border 0.5px #E5E7EB
  Mini blue  : bg #EFF6FF, border #BFDBFE, color #1D4ED8, 7px 600
  Mini green : bg #DCFCE7, border #BBF7D0, color #15803D
  Mini red   : bg #FEE2E2, border #FECACA, color #DC2626
  Mini gray  : bg #F3F4F6, border #E5E7EB, color #374151
  border-radius: 5px, padding: 3px 7px

FORM INPUT:
  border 0.5px #E5E7EB, border-radius 5px, padding 4px 7px
  font-size 8px, color #374151, bg #fff

AVATAR (inisial):
  width 22px, height 22px, border-radius 50%
  bg #EFF6FF, border 0.5px #BFDBFE, font 7px 700 #1D4ED8

SOS ALERT BANNER (conditional, hanya jika ada SOS aktif):
  bg #FEF2F2, border 1px #FECACA, border-radius 6px, padding 6px 10px
  Tampil di ATAS semua konten, z-index tinggi
  Tidak bisa di-dismiss sampai SOS resolved
  Isi: nama teknisi, lokasi, tombol [Lihat Peta] [Hubungi]

CHART (Recharts):
  Warna: sesuai iOS system colors (#007AFF, #34C759, #FF9F0A, #FF453A)
  Bar chart untuk data per hari/kategori
  Line chart untuk data tren
  Selalu disertai legenda

PETA (Leaflet.js + OpenStreetMap):
  Tiles: OpenStreetMap gratis
  Pin warna: biru=kunjungan, hijau=kantor, oranye=alert, abu=idle, merah=SOS
  SOS pin: pulse animation CSS
  Dark overlay opsional untuk latar peta
```

---

### W-01 · DASHBOARD BERANDA

```
TOPBAR: "Dashboard" | [+ Buat Tugas] [Export] [🔔3] [HW]

BARIS 1 — METRIC CARDS (grid 4 kolom):
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│ HADIR      │ │ DI LAPANGAN│ │ TUGAS      │ │ BERITA     │
│ HARI INI   │ │            │ │ HARI INI   │ │ ACARA      │
│ "24"       │ │ "7"        │ │ "11"       │ │ "6"        │
│ dari 28    │ │ 4 kunjungan│ │ 6 selesai  │ │ terbit hari│
│ [85.7%]    │ │ [●Live]    │ │ [55%]      │ │ [+2 kemarin│
└────────────┘ └────────────┘ └────────────┘ └────────────┘

BARIS 2 — MAIN CONTENT (grid 60% | 40%):
┌──────────────────────────┐ ┌────────────────────┐
│ PETA MONITORING LIVE     │ │ AKTIVITAS KUNJUNGAN │
│ Leaflet, height 200px    │ │ Bar chart Recharts   │
│ Pin warna per status     │ │                     │
│ Stats bar di bawah peta  │ │ APPROVAL MENUNGGU:  │
│ "4 Kvj · 2 Kantor · ..." │ │ list delegate/swap  │
│                          │ │ + tombol ✓ ✗ inline │
└──────────────────────────┘ └────────────────────┘

BARIS 3 — BOTTOM (grid 3 kolom):
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ DISPATCH & TUGAS │ │ ABSENSI HARI INI │ │ NOTIFIKASI SISTEM│
│ list 3 tugas     │ │ Hadir/Terlambat  │ │ SLA warning      │
│ pill prioritas   │ │ Alfa/Izin        │ │ BA terbit        │
│                  │ │                  │ │ Backup status    │
└──────────────────┘ └──────────────────┘ └──────────────────┘

SOS BANNER (jika ada — SELALU di paling atas):
┌──────────────────────────────────────────────────────────┐
│ 🚨 SOS AKTIF — [Nama] · [Lokasi]                        │
│ [LIHAT DI PETA]  [HUBUNGI]  [TANDAI RESPONS]            │
│ bg #FEF2F2, border #FECACA                              │
└──────────────────────────────────────────────────────────┘

KOMPONEN KUNCI:
- Semua metric card interactive (klik → navigasi ke halaman terkait)
- Peta: pin click → tooltip info singkat teknisi
- Approval inline: ✓ atau ✗ langsung dari dashboard
- Refresh otomatis setiap 30 detik (tanpa full reload, SWR/React Query)
```

---

### W-02 · MONITORING LIVE

```
TOPBAR: "Monitoring Live" | [Filter Dept ▼] [Export]

LAYOUT (split panel, full height):
┌──────────────────────────────────┬──────────────────┐
│ PETA PENUH                       │ PANEL KANAN 200px│
│ height: calc(100vh - 96px)       │                  │
│                                  │ [Search input]   │
│ Filter pills di atas peta:       │                  │
│ [Semua] [Kunjungan] [Kantor]     │ "12 Aktif"       │
│ [Alert] [Idle]                   │                  │
│                                  │ Card per teknisi:│
│ Legend kanan atas (glass card):  │ ┌──────────────┐ │
│ ● Kunjungan aktif  = biru        │ │ [av] Ahmad F │ │
│ ● Di kantor        = hijau       │ │ ●Kunjungan   │ │
│ ● GPS Alert        = oranye      │ │ PT. Maju...  │ │
│ ● Menganggur       = abu         │ └──────────────┘ │
│ ● SOS              = merah pulse │ (scroll)         │
│                                  │                  │
│ Stats bar bawah (glass overlay): │ Klik card →      │
│ 4 Kunjungan · 2 Kantor           │ peta zoom ke     │
│ 1 Alert · 5 Idle                 │ lokasi teknisi   │
└──────────────────────────────────┴──────────────────┘

GPS UPDATE: WebSocket realtime, pin bergerak sesuai posisi
SOS: pin merah + pulse animation, peta auto-zoom ke lokasi SOS
```

---

### W-03 · KONFIGURASI JADWAL

```
TOPBAR: "Konfigurasi Jadwal" | [+ Tambah Jadwal]

TABS: [Shift Kerja] [Jadwal Mingguan] [Cuti & Libur]
      [Piket On-Call] [Histori Perubahan]

TAB: SHIFT KERJA (split 200px | flex):
┌────────────────────────┐ ┌──────────────────────────────┐
│ DAFTAR TIPE SHIFT      │ │ GRID ASSIGN SHIFT            │
│                        │ │                              │
│ ● Shift Pagi           │ │ Filter: [Dept▼] [Minggu▼]   │
│   07:00–15:00 · 18 org │ │                              │
│   [Edit] [Hapus]       │ │ TABEL: Karyawan × 7 Hari    │
│                        │ │ (klik sel = assign shift)   │
│ ● Shift Siang          │ │                              │
│   14:00–22:00 · 12 org │ │ WARNA SEL:                  │
│   [Edit]               │ │ Pagi = biru, Siang = oranye  │
│                        │ │ Malam = ungu, Libur = abu    │
│ ● Shift Malam          │ │                              │
│   22:00–06:00 · 8 org  │ │ Navigasi: [‹ Minggu Lalu]   │
│   [Edit]               │ │           [Minggu Ini]       │
│                        │ │           [Minggu Depan ›]  │
│ [+ Tambah Tipe Shift]  │ │                              │
│                        │ │ [SIMPAN PERUBAHAN]           │
│ ─── Konfigurasi ────   │ │                              │
│ Toleransi : 60 menit   │ │                              │
│ Durasi    : 8 jam      │ │                              │
│ Batas alfa: 4 jam      │ │                              │
└────────────────────────┘ └──────────────────────────────┘

TAB: HISTORI PERUBAHAN:
Filter: [Karyawan▼] [Jenis▼] [Tgl mulai] [s/d] [Terapkan]
TABEL: Tgl Ubah | Karyawan | Diubah Oleh | Sebelum | Sesudah
       3 Apr    | Ahmad F  | Admin HR    | Pagi    | Siang
       (pagination)

MODAL TAMBAH/EDIT SHIFT:
  Nama, Jam mulai, Jam selesai (validasi real-time 8 jam)
  Warna (color picker pill)
  Departemen
  [SIMPAN SHIFT] [Batal]
```

---

### W-04 · DISPATCH & TUGAS

```
TOPBAR: "Dispatch & Tugas" | [+ Buat Tugas]

LAYOUT (split 1fr | 180px):
┌──────────────────────────────────┬──────────────────┐
│ KANBAN BOARD                     │ FORM BUAT TUGAS  │
│                                  │ (sticky panel)   │
│ [Unassigned][Pending]            │                  │
│ [Assigned][Ongoing][Selesai]     │ Judul            │
│                                  │ Jenis, Prioritas │
│ 4 kolom board:                   │ Klien            │
│ ┌──────┐┌──────┐┌──────┐┌──────┐│ Template BA      │
│ │Unassg││Pendin││Assign││Ongoin│││ Assign: Langsung │
│ │ card ││ card ││ card ││ card │││ atau Broadcast   │
│ │      ││      ││      ││      │││                  │
│ └──────┘└──────┘└──────┘└──────┘│ [BUAT & KIRIM]  │
│                                  │                  │
│ Task card:                       │ ─────────────── │
│ - Nama tugas                     │ APPROVAL PENDING │
│ - Klien · Prioritas badge        │                  │
│ - Teknisi (jika assigned)        │ Delegasi Ahmad→R │
│ - [ASSIGN] jika unassigned       │ [✓] [✗]         │
│                                  │ Swap Budi↔Sari   │
│ Toggle: [Board] [Tabel]          │ [✓] [✗]         │
└──────────────────────────────────┴──────────────────┘

ON-HOLD TASKS (tab atau filter terpisah):
Tabel: Teknisi | Tugas | Alasan | Foto Bukti | Sejak | Aksi
       Ahmad F | Maint. AC | Klien Absen | 3 foto | 2j lalu | [Review]

DETAIL ON-HOLD (slide panel kanan):
  Info tugas + alasan + foto bukti teknisi
  [APPROVE + SET RESCHEDULE] → pilih tanggal + teknisi
  [REJECT ON-HOLD] → teknisi lanjutkan sekarang
```

---

### W-05 · KUNJUNGAN & BERITA ACARA

```
TOPBAR: "Kunjungan" | [Filter ▼] [Export]

TABS: [Semua Kunjungan] [Berita Acara] [On Hold (2)]

TAB: SEMUA KUNJUNGAN
Filter bar: [Search] [Status▼] [Teknisi▼] [Klien▼] [Tanggal]

TABEL:
Teknisi | Klien | Check-in | Durasi | Foto | Status | Aksi
Ahmad F | Maju  | 10:32    | 1j24m  | 8/16 | ●Berjalan| [Lihat]
Budi S  | Karya | 09:00    | 2j10m  | 18/16| ●Selesai | [BA]
Riko S  | Sinar | 11:00    | 0j45m  | 3/16 | ⏸Ditunda | [Review]

STATUS BADGE WARNA:
  Berjalan     : pill biru
  Selesai      : pill hijau
  ⏸ Ditunda   : pill oranye (on_hold — perlu review)
  Dijadwal ulang: pill ungu (rescheduled)
  Dibatalkan   : pill merah

DETAIL KUNJUNGAN (slide panel dari kanan):
  Header: nama tugas + klien + teknisi + durasi
  ─── Tab: Sebelum | Proses | Sesudah ───
  Grid thumbnail foto (4 kolom), klik = lightbox
  ─── Laporan ───
  Temuan, Rekomendasi, Material digunakan
  ─── Berita Acara ───
  [LIHAT PDF BA] [DOWNLOAD] [KIRIM ULANG KE KLIEN]

TAB: BERITA ACARA
TABEL: No BA | Teknisi | Klien | Tanggal | Status | Aksi
       BA-001 | Ahmad F | Maju  | 3 Apr   | ●Terkirim| [PDF]

TAB: ON HOLD (2)
TABEL: Teknisi | Tugas | Alasan | Sejak | Auto-approve | Aksi
       Riko S  | CCTV  | Klien Absen | 2j | 2j lagi | [Review]
```

---

### W-06 · KLAIM BIAYA

```
TOPBAR: "Klaim Biaya" | [Export Payroll Excel]

TABS: [Semua] [Pending (4)] [Approved] [Paid] [Rekap Payroll]

SUMMARY CARDS (grid 3 kolom):
┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ PENDING        │ │ TOTAL APPROVED │ │ TOTAL BULAN INI│
│ "4 klaim"      │ │ "Rp 1.250.000" │ │ "Rp 2.400.000" │
│ menunggu review│ │ bulan ini      │ │ semua status   │
└────────────────┘ └────────────────┘ └────────────────┘

TABEL:
No | Karyawan | Tgl | Kategori | Nominal | Kunjungan | Status | Aksi
(approve/tolak inline langsung dari tabel)

DETAIL KLAIM (slide panel):
  Header: no klaim + karyawan + kategori + nominal
  Keterangan + kunjungan terkait
  Foto nota (thumbnail, klik zoom)
  [APPROVE] [TOLAK + alasan] [TANDAI PAID]

TAB: REKAP PAYROLL
  Filter: [Bulan: April 2025 ▼] [Dept ▼]
  TABEL: Karyawan | Transport | Parkir | Material | Konsumsi | TOTAL
  Footer: Total per kategori
  [EXPORT EXCEL PAYROLL] → download file xlsx SheetJS
```

---

### W-07 · SOS & DARURAT

```
TOPBAR: "SOS & Darurat" | [+ Tambah Kontak Darurat]

TABS: [SOS Aktif (N)] [Riwayat SOS] [Kontak Darurat]

TAB: SOS AKTIF
Jika tidak ada SOS:
  "Tidak ada SOS aktif saat ini ✓" — ilustrasi + teks tengah

Jika ada SOS (tampilkan banner merah + detail):
┌──────────────────────────────────────────────────────┐
│ Banner: 🚨 SOS AKTIF — [Nama] · [Waktu] · [Durasi]  │
├──────────────────────────────────────────────────────┤
│ LAYOUT 2 KOLOM (1fr | 200px):                        │
│ ┌────────────────────────┐ ┌────────────────────────┐│
│ │ PETA zoom ke SOS       │ │ INFO KARYAWAN          ││
│ │ Pin merah + pulse CSS  │ │ Nama, Avatar           ││
│ │ Polyline tracking merah│ │ 📱 No HP               ││
│ │ height: 280px          │ │ 📍 Lokasi              ││
│ │                        │ │ 🔋 Baterai             ││
│ │                        │ │ Kunjungan aktif        ││
│ │                        │ │                        ││
│ │                        │ │ [HUBUNGI LANGSUNG]     ││
│ │                        │ │ [TANDAI DIRESPONS]     ││
│ │                        │ │ [TANDAI SELESAI]       ││
│ └────────────────────────┘ └────────────────────────┘│
└──────────────────────────────────────────────────────┘

TAB: RIWAYAT SOS
TABEL: Karyawan | Waktu | Lokasi | Durasi | Status | Direspons

TAB: KONTAK DARURAT
TABEL: Nama | Jabatan | No HP | Prioritas | Aktif | Aksi
       + modal tambah/edit kontak
```

---

### W-08 · LAPORAN

```
TOPBAR: "Laporan" | [Export Excel] [Export PDF]

TABS: [Absensi] [Kunjungan] [Cuti] [Klaim Biaya] [Lembur] [Pelanggaran]

FILTER BAR (semua tab):
[Dept ▼] [Karyawan ▼] [Dari: tgl] [s/d: tgl] [Terapkan]

TAB: ABSENSI
METRIC (4 card): Total Hadir | Terlambat | Alfa | Izin/Sakit
CHART: Bar chart kehadiran per hari (Recharts, warna #007AFF)
TABEL: Karyawan | Hadir | Terlambat | Alfa | Izin | % Hadir
       warna % : hijau ≥95% | oranye ≥85% | merah <85%

TAB: KUNJUNGAN
METRIC: Total Kunjungan | Avg Durasi | Total Foto | BA Terbit
CHART: Line chart kunjungan per hari
TABEL: Teknisi | Total | Avg Durasi | Klien Unik | Foto | BA

TAB: LEMBUR (BARU)
METRIC: Total Jam Lembur | Hari Lembur | Avg per Karyawan | Max
CHART: Bar chart lembur per karyawan (horizontal)
TABEL: Karyawan | Dept | Hari Lembur | Total Menit | Total Jam
[EXPORT EXCEL PAYROLL LEMBUR] — format untuk HR

TAB: CUTI
METRIC: Saldo Rata-rata | Digunakan | Hangus Akhir Tahun | Pending
TABEL: Karyawan | Saldo | Digunakan | Sisa | Hangus | Status

TAB: PELANGGARAN
TABEL: Karyawan | Tgl | Tipe | Deskripsi | Status | SP
       + filter: alfa tanpa saldo, SP aktif
```

---

### W-09 · PENGATURAN

```
TOPBAR: "Pengaturan"

LAYOUT (split 160px | flex):
┌──────────────────────┐
│ NAV KIRI (vertikal): │
│ Profil Perusahaan    │
│ Aturan Absensi ←aktif│
│ Aturan Cuti          │
│ Batas Klaim Biaya    │
│ Dispatch & Tugas     │
│ WhatsApp             │
│ Backup & Restore     │
│ Kontak Darurat       │
└──────────────────────┘

PANEL: ATURAN ABSENSI
  Toleransi keterlambatan: [60] menit [Edit]
  Durasi shift (terkunci):  8 jam (info, tidak bisa diedit)
  Batas alfa:              [4] jam dari jam mulai
  Window keberatan alfa:   [24] jam

PANEL: ATURAN CUTI
  Max cuti per tahun:    [12] hari
  Akrual bulanan:         [1] hari
  Kompensasi libur:       [1] hari
  Reminder hangus:        H-[30] dan H-[7]

PANEL: BATAS KLAIM BIAYA
  TABEL (editable inline):
  Kategori  | Batas Max   | Wajib Nota > | Aktif
  Transport | Rp 500.000  | Rp 50.000    | ✓ [Edit]
  Parkir    | Rp 100.000  | Rp 50.000    | ✓ [Edit]
  Material  | Rp 2.000.000| Rp 100.000   | ✓ [Edit]
  Konsumsi  | Rp 150.000  | Rp 50.000    | ✓ [Edit]

PANEL: WHATSAPP
  Status: [● Connected] atau [● Disconnected]
  Nomor aktif: 0812xxx
  [Lihat QR Code untuk scan ulang] / [Reconnect]
  Rate limit: 100 pesan/jam, jeda 2 detik

PANEL: BACKUP & RESTORE
  ┌──────────────────────────────────────────┐
  │ ✅ Backup Terakhir Berhasil              │  ← card hijau
  │ 3 Apr 2025 · 02:00 WITA · 245 MB        │
  │ Checksum: a3f2b1c4...                    │
  └──────────────────────────────────────────┘
  Jadwal: Full 02:00 · Incremental 08:00/14:00/20:00
  Enkripsi: AES-256 · Retensi: 30 hari

  TABEL BACKUP TERSEDIA:
  Tgl/Waktu    | Tipe  | Ukuran | Status | Aksi
  3 Apr 02:00  | Full  | 245 MB | ✅     | [Restore]
  2 Apr 20:00  | Incr  | 12 MB  | ✅     | [Restore]

  [▶ BACKUP MANUAL SEKARANG]

  RESTORE: modal konfirmasi dengan ketik "RESTORE" untuk konfirmasi
```

---

### W-10 · MANAJEMEN KLIEN & SLA

```
TOPBAR: "Klien & SLA" | [+ Tambah Klien]

TABS: [Semua Klien] [Emergency] [Priority] [SLA Dashboard]

TAB: SEMUA KLIEN
Filter: [Search] [Tipe Kontrak▼] [Status SLA▼]

TABEL:
Nama Klien | Kontrak | SLA Response | Kuota/Bln | Status SLA | Aksi
PT. Maju   | Priority| 4 jam        | 8/10      | ✅ Aman    | [Detail]
PT. Sentosa| Emergency| 2 jam       | 3/5       | ⚠ At Risk  | [Detail]
PT. Karya  | Regular | 24 jam       | 10/10     | ❌ Habis   | [Detail]

Kuota: progress bar visual (merah jika habis)

TAB: SLA DASHBOARD
METRIC (4 card): SLA OK | At Risk | Breach | Avg Response
CHART: Bar chart response time per klien
AT RISK NOW: tabel klien yang hampir breach + countdown

DETAIL KLIEN (slide panel):
  Header: nama klien + tipe kontrak badge
  Kontrak: nomor, berlaku, account manager
  [📄 Lihat Dokumen Kontrak]
  ─── SLA Agreement ───
  Response time: max X jam
  Completion time: max X jam
  Kuota kunjungan: X/bulan
  ─── Performa SLA Bulan Ini ───
  Response avg | Completion avg | Kunjungan | Breach
  ─── Riwayat SLA ───
  TABEL per bulan

TAMBAH/EDIT KLIEN (modal):
  Nama, PIC, HP, email, alamat
  Tipe kontrak, No kontrak, Berlaku
  SLA response (jam), SLA completion (jam)
  Kuota kunjungan/bulan
  Account manager
  [Upload Dokumen Kontrak]
```

---

### W-11 · PENGUMUMAN

```
TOPBAR: "Pengumuman" | [+ Buat Pengumuman]

LAYOUT (split 220px | flex):
┌───────────────────────────┐ ┌────────────────────────────┐
│ DAFTAR PENGUMUMAN (kiri)  │ │ FORM BUAT PENGUMUMAN       │
│                           │ │                            │
│ [Search input]            │ │ Judul: [__________________]│
│                           │ │                            │
│ ┌─────────────────────┐   │ │ Isi: [Rich text area      ]│
│ │ 📌 PENTING          │   │ │      [4 baris             ]│
│ │ Perubahan Jam Kerja │   │ │                            │
│ │ 95% sudah baca      │   │ │ Tipe: [Info][Urgent]       │
│ │ ████████████░ bar   │   │ │       [Libur][Kebijakan]   │
│ └─────────────────────┘   │ │                            │
│                           │ │ Kirim ke:                  │
│ ┌─────────────────────┐   │ │ ● Semua karyawan           │
│ │ 🔴 URGENT           │   │ │ ○ Departemen: [▼]          │
│ │ Rapat Wajib Teknisi │   │ │ ○ Individu: [cari]         │
│ │ 60% sudah baca      │   │ │                            │
│ │ ████████░░░░ bar    │   │ │ Opsi:                      │
│ └─────────────────────┘   │ │ ☑ Push notification        │
│                           │ │ ☐ WhatsApp                 │
│ ┌─────────────────────┐   │ │ ☐ Pin pengumuman           │
│ │ 🟢 Libur Idul Fitri │   │ │ Pin s/d: [tanggal]         │
│ │ 100% sudah baca ✓   │   │ │ Lampiran: [Upload]         │
│ └─────────────────────┘   │ │                            │
│                           │ │ [KIRIM SEKARANG] [Draft]   │
└───────────────────────────┘ │                            │
                              │ ─── STATISTIK BACA ──────  │
                              │ Rapat Wajib Teknisi         │
                              │ ┌────────┐ ┌────────┐      │
                              │ │Baca: 18│ │Belum:12│      │
                              │ └────────┘ └────────┘      │
                              │ ████████████░░░░ 60%        │
                              │ [Kirim Reminder ke 12 org] │
                              └────────────────────────────┘

TIPE PENGUMUMAN & BADGE:
  info    : pill biru  — info umum
  urgent  : pill merah — mendesak
  holiday : pill hijau — libur/cuti bersama
  policy  : pill ungu  — kebijakan

PIN: badge "📌 PENTING" di atas card, selalu urutan pertama di list
```

---

### 11.2 Catatan Implementasi UI untuk Agent

```
WAJIB DIIKUTI SAAT CODING WEB:

1. Sidebar SELALU tampil di semua halaman dashboard
   Collapse di lebar < 1024px (hide label, hanya ikon)

2. Topbar: nama halaman KIRI, CTA + notif + avatar KANAN
   CTA button: warna biru, icon + teks

3. Tabel data WAJIB punya: search, filter, sort kolom, pagination
   Pagination: "Menampilkan 1–20 dari 150 data"
   Sort: klik header kolom, ikon ↑↓

4. Form dalam slide panel dari KANAN (width 320px)
   KECUALI: form panjang (buat karyawan baru) → modal full

5. Aksi approve/tolak bisa inline dari tabel
   Konfirmasi destruktif: AlertDialog shadcn/ui

6. Chart/grafik: Recharts, warna iOS system colors
   Selalu ada legenda, tooltip saat hover

7. Peta: Leaflet.js + OpenStreetMap tiles (gratis)
   Tema: standard tile, pin warna sesuai status

8. Alert SOS: z-index tertinggi, bg merah, tidak bisa dismiss
   Muncul di atas semua konten

9. Export: download langsung via SheetJS/Puppeteer
   Tombol export selalu ada di topbar kanan

10. Loading state: skeleton Tailwind animate-pulse
    Error state: toast Sonner / react-hot-toast kanan bawah
    Empty state: ilustrasi SVG + teks deskriptif

11. Real-time data: TanStack Query dengan refetchInterval 30s
    WebSocket untuk monitoring live dan SOS tracking

12. Responsive minimum 1024px (laptop/desktop focused)
    Tidak perlu fully mobile-responsive

KONSISTENSI STATUS WARNA (wajib konsisten di semua halaman):
  Hadir / Selesai / Approved / OK  → green  (#15803D bg #DCFCE7)
  Terlambat / Pending / At Risk    → orange (#C2410C bg #FFEDD5)
  Alfa / Rejected / Breach / SOS  → red    (#DC2626 bg #FEE2E2)
  Berjalan / Aktif / Live / Assign → blue   (#1D4ED8 bg #DBEAFE)
  On-call / Delegasi / Rescheduled → purple (#6D28D9 bg #EDE9FE)
  Kunjungan / Info / Teal          → teal   (#0E7490 bg #ECFEFF)
  Libur / Netral / Idle            → gray   (#6B7280 bg #F3F4F6)
```



## 12. SPESIFIKASI MAP, ROUTING & NAVIGASI

### 12.1 Stack Map Lengkap
```
TAMPILAN PETA:
├── Web dashboard:    Leaflet.js + React-Leaflet
├── Mobile app:       react-native-maps (OSM tiles)
├── Tile server:      OpenStreetMap (gratis, tanpa key)
└── Alternatif tile:  Maptiler free tier (100K tiles/bln, lebih cepat)

KALKULASI JARAK & WAKTU:
├── Engine:           OSRM (Open Source Routing Machine)
├── Endpoint:         http://router.project-osrm.org/route/v1/driving/
├── Output:           distance (meter), duration (detik), polyline rute
├── Mode default:     driving (berkendara)
└── Biaya:            GRATIS, tanpa API key

REVERSE GEOCODING (koordinat → nama wilayah):
├── Engine:           Nominatim (OpenStreetMap)
├── Endpoint:         https://nominatim.openstreetmap.org/reverse
├── Cache:            Redis, key = "geo:{lat4d}_{lng4d}", TTL 30 hari
├── Output:           kabupaten, provinsi, alamat lengkap
└── Biaya:            GRATIS, tanpa API key

NAVIGASI NYATA DI JALAN:
├── Method:           Deep link ke Google Maps atau Waze
├── Format Google:    https://maps.google.com/?q=LAT,LNG&navigate=yes
├── Format Waze:      https://waze.com/ul?ll=LAT,LNG&navigate=yes
├── Trigger:          Tombol "Navigasi" di app → buka app eksternal
└── Alasan:           Lebih akurat & familiar untuk teknisi lapangan
```

### 12.2 Cara Kerja OSRM
```javascript
// Contoh request OSRM
// Format: lon,lat (BUKAN lat,lon — perhatikan urutannya!)
const url = `${OSRM_API_URL}/driving/
  ${originLng},${originLat};
  ${destLng},${destLat}
  ?overview=full&geometries=geojson`

// Response
{
  "routes": [{
    "distance": 3241.4,        // meter → tampilkan "3.2 km"
    "duration": 742.3,         // detik → tampilkan "~12 menit"
    "geometry": {              // GeoJSON polyline untuk digambar di peta
      "type": "LineString",
      "coordinates": [[lng,lat], [lng,lat], ...]
    }
  }]
}

// Helper functions WAJIB ada di shared/utils/routing.ts:
formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters/1000).toFixed(1)} km`
}

formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `~${minutes} menit`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `~${hours}j ${mins}m`
}

openGoogleMapsNavigation(lat: number, lng: number): void {
  const url = `https://maps.google.com/?q=${lat},${lng}&navigate=yes`
  Linking.openURL(url) // React Native
  // atau: window.open(url, '_blank') // Web
}

openWazeNavigation(lat: number, lng: number): void {
  const url = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
  Linking.openURL(url)
}
```

### 12.3 Implementasi di Setiap Fitur

#### A. FITUR TUGAS & DISPATCH — Kalkulasi jarak ke lokasi tugas
```
KAPAN DIHITUNG:
- Saat teknisi menerima notif tugas baru
- Saat teknisi buka detail tugas
- Update setiap 5 menit jika teknisi sedang bergerak

TAMPILAN MOBILE (card tugas):
┌─────────────────────────────────────┐
│ Maintenance AC – Gedung B           │
│ PT. Maju Bersama · 10:30 WITA       │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [MINI MAP Leaflet, height 120px]│ │
│ │                                 │ │
│ │  📍 (biru = posisi saya)        │ │
│ │    ≈≈≈≈ polyline rute ≈≈≈≈     │ │
│ │              📍 (merah = tujuan)│ │
│ └─────────────────────────────────┘ │
│ 📏 3.2 km  ⏱ ~12 menit berkendara  │
│                                     │
│ [ 🗺 BUKA NAVIGASI ]               │ ← deep link Google Maps/Waze
└─────────────────────────────────────┘

TAMPILAN WEB (detail tugas, panel kanan):
- Mini map Leaflet dengan polyline OSRM
- "3.2 km dari posisi teknisi · ~12 menit"
- Tombol [Navigasi ke Lokasi] → deep link
```

#### B. FITUR DISPATCH OTOMATIS — Cari teknisi terdekat
```
LOGIKA auto-assign berdasarkan jarak OSRM (bukan garis lurus):

findBestAvailableTechnician(taskLat, taskLng):
  1. Filter teknisi: is_active=true, tidak sedang kunjungan
  2. Untuk setiap teknisi yang tersedia:
     - Ambil posisi GPS terakhir dari Redis
     - Hitung jarak via OSRM ke lokasi task
  3. Sort berdasarkan distance ascending
  4. Assign ke teknisi dengan distance terkecil
  5. Jika OSRM timeout → fallback haversine formula (garis lurus)

// Haversine fallback (garis lurus, tanpa road network):
haversineDistance(lat1, lng1, lat2, lng2): number {
  const R = 6371000 // meter
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat/2)**2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}
```

#### C. FITUR MONITORING LIVE — Peta dashboard manajer
```
TAMPILAN WEB (W-02 Monitoring Live):
- Leaflet full screen dengan OpenStreetMap tiles
- Pin per teknisi (update realtime via WebSocket)
- Warna pin: biru=kunjungan aktif, hijau=kantor, merah=alert/SOS
- Klik pin teknisi → popup: nama, status, tugas aktif, jarak dari kantor
- Polyline rute aktif (teknisi → lokasi tugas yang sedang dikerjakan)

UPDATE POSISI:
- Mobile kirim GPS tiap 30 detik via WebSocket (saat shift aktif)
- Simpan posisi terakhir di Redis: key = "location:{userId}"
- TTL 5 menit (jika tidak update, dianggap offline)
- Dashboard web receive event 'technician:location' via Socket.io
```

#### D. FITUR SOS DARURAT — Navigasi ke lokasi teknisi
```
SAAT SOS AKTIF:

1. DASHBOARD WEB (manajer):
┌──────────────────────────────────────────────────────┐
│ 🚨 SOS AKTIF — Ahmad Fauzi · 00:03:24               │
├──────────────────────┬───────────────────────────────┤
│ PETA LEAFLET         │ INFO TEKNISI                  │
│                      │ Ahmad Fauzi                   │
│ 📍 Kantor/Manajer    │ 📱 08123456789                │
│   ≈≈≈≈ rute ≈≈≈≈    │ 📍 Kab. Badung, Bali          │
│      📍 SOS (pulse)  │ 🔋 45%                        │
│                      │                               │
│ Polyline OSRM:       │ 📏 4.2 km dari kantor         │
│ Kantor → Teknisi     │ ⏱ ~8 menit berkendara         │
│                      │                               │
│                      │ [ 📞 HUBUNGI LANGSUNG ]       │
│                      │ [ 🗺 NAVIGASI KE LOKASI ]     │
│                      │    → deep link Google Maps    │
│                      │ [ ✓ TANDAI DIRESPONS ]        │
└──────────────────────┴───────────────────────────────┘

2. NOTIF WA KE MANAJER & KONTAK DARURAT:
🚨 DARURAT - SOS AKTIF 🚨

Ahmad Fauzi membutuhkan bantuan segera!

📍 Lokasi saat ini:
Lat: -8.563291 | Lng: 115.087821
Kab: Kab. Badung · Prov: Bali

📏 Jarak dari kantor: 4.2 km
⏱ Estimasi tiba: ~8 menit berkendara

🗺 NAVIGASI KE LOKASI:
https://maps.google.com/?q=-8.563291,115.087821&navigate=yes

📱 Hubungi: 08123456789
🔋 Baterai: 45%
⏰ SOS aktif: 14:32:08 WITA · 3 Apr 2025

Update lokasi dikirim setiap 15 detik.

3. MOBILE MANAJER (notif SOS masuk):
┌─────────────────────────────────────┐
│ 🚨 SOS — Ahmad Fauzi               │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [MINI MAP Leaflet]              │ │
│ │ 📍 Posisi saya                  │ │
│ │   ≈≈≈ polyline rute OSRM ≈≈≈   │ │
│ │          📍 Ahmad (SOS pulse)   │ │
│ └─────────────────────────────────┘ │
│ 📏 4.2 km  ⏱ ~8 menit             │
│                                     │
│ [ 🗺 NAVIGASI KE LOKASI ]          │ ← buka Google Maps
│ [ 📞 HUBUNGI AHMAD ]               │
│ [ ✓ TANDAI SUDAH DIRESPONS ]       │
└─────────────────────────────────────┘

4. TRACKING REALTIME SAAT SOS:
- Teknisi kirim GPS tiap 15 detik (lebih sering dari normal 30 detik)
- Peta manajer update otomatis via WebSocket
- Polyline di peta menunjukkan jalur pergerakan teknisi (track history)
- Pin teknisi animasi pulse merah agar mudah dilihat
```

#### E. FITUR KUNJUNGAN — GPS check-in & rute perjalanan
```
CHECK-IN KUNJUNGAN:
- Validasi GPS teknisi dalam radius klien (haversine, cukup akurat)
- Tampilkan di map: "Anda berada X meter dari lokasi klien"
- Jika di luar radius → warning + tampilkan peta posisi vs lokasi klien

RUTE PERJALANAN (route_polyline di tabel visits):
- Rekam polyline perjalanan dari kantor ke klien
- Simpan sebagai encoded polyline di kolom route_polyline
- Tampilkan di web saat admin lihat detail kunjungan
- Berguna untuk verifikasi teknisi benar-benar ke lokasi
```

### 12.4 Struktur Folder Tambahan
```
shared/src/utils/
├── routing.ts              ← formatDistance, formatDuration, openNavigation
├── coordinate.ts           ← format 6 desimal, haversine fallback
└── geocoding.ts            ← interface Nominatim response

backend/src/modules/
└── routing/
    ├── osrm.service.ts     ← kalkulasi jarak & rute via OSRM API
    ├── nominatim.service.ts← reverse geocoding + Redis cache
    └── routing.module.ts

apps/mobile/src/components/
└── map/
    ├── MiniMap.tsx         ← mini map dengan polyline (react-native-maps)
    ├── LiveTrackingMap.tsx ← full map monitoring (SOS screen)
    └── NavigationButton.tsx← tombol buka Google Maps/Waze

apps/web/src/components/
└── map/
    ├── LiveMap.tsx         ← full Leaflet map dashboard monitoring
    ├── MiniMap.tsx         ← mini map di card tugas/kunjungan
    ├── SOSMap.tsx          ← peta khusus SOS dengan tracking
    └── RoutePolyline.tsx   ← komponen polyline OSRM di atas Leaflet
```

### 12.5 Tambahan di Fase Pengerjaan
```
Masuk ke FASE 3 (Absensi & Dashboard), task tambahan:

[ ] Map 1  Backend: osrm.service.ts
           - getRoute(originLat, originLng, destLat, destLng)
           - Return: { distance, duration, polyline }
           - Fallback: haversine jika OSRM timeout/error

[ ] Map 2  Backend: nominatim.service.ts
           - reverseGeocode(lat, lng): { district, province, address }
           - Cache Redis key = "geo:{lat4d}_{lng4d}", TTL 30 hari
           - Rate limit: max 1 req/detik (Nominatim fair use policy)

[ ] Map 3  shared/utils/routing.ts
           - formatDistance(), formatDuration()
           - openGoogleMapsNavigation(lat, lng)
           - openWazeNavigation(lat, lng)
           - haversineDistance() sebagai fallback

[ ] Map 4  Mobile: MiniMap component
           - Tampilkan 2 pin (asal + tujuan) + polyline OSRM
           - Height: 120px untuk card tugas, 200px untuk detail

[ ] Map 5  Mobile: NavigationButton component
           - Pilih antara Google Maps atau Waze
           - Deep link dengan koordinat sudah di-set

[ ] Map 6  Web: LiveMap component (Leaflet)
           - Full screen peta monitoring
           - Marker per teknisi + realtime update WebSocket
           - Klik marker → popup info + tombol navigasi

[ ] Map 7  Web: SOSMap component
           - Extend LiveMap khusus untuk SOS
           - Pin pulse animation merah
           - Polyline tracking history SOS
           - Panel info + tombol navigasi

[ ] Map 8  Integrasi OSRM ke dispatch auto-assign
           - Sort teknisi berdasarkan jarak OSRM ke lokasi task
           - Fallback ke haversine jika OSRM lambat

Definition of Done:
✓ Mini map tampil di card tugas dengan 2 pin + polyline rute
✓ Jarak & waktu tampil akurat: "3.2 km · ~12 menit"
✓ Tombol navigasi buka Google Maps dengan tujuan sudah di-set
✓ Peta dashboard monitoring update realtime saat teknisi bergerak
✓ SOS → peta zoom ke lokasi + polyline tracking + notif WA dengan link navigasi
✓ Auto-assign pilih teknisi terdekat berdasarkan OSRM distance
✓ Nominatim reverse geocoding menghasilkan kab + prov yang benar
✓ Cache Redis mencegah Nominatim rate limit
```

### 12.6 Catatan Penting untuk Agent
```
OSRM:
1. Format koordinat: LONGITUDE dulu, baru LATITUDE (kebalikan dari biasa!)
   SALAH:  /driving/lat,lng;lat,lng
   BENAR:  /driving/lng,lat;lng,lat

2. Public OSRM API ada rate limit tidak resmi ~1 req/detik
   Untuk production: pertimbangkan self-host OSRM di server sendiri
   atau gunakan OpenRouteService (2000 req/hari gratis)

3. OSRM hanya untuk jalan darat (driving)
   Tidak ada mode motor terpisah → tetap pakai 'driving'

NOMINATIM:
1. Wajib set User-Agent header yang identifiable:
   'User-Agent': 'NustechAttendenX/1.0 (contact@nustech.id)'
   Tanpa ini → request bisa diblokir

2. Rate limit Nominatim: maksimum 1 request/detik
   Wajib ada Redis cache untuk mencegah spam request

3. Response field yang dipakai:
   address.county    → nama kabupaten/kota
   address.state     → nama provinsi
   display_name      → alamat lengkap

LEAFLET:
1. Import CSS Leaflet wajib di _app.tsx atau layout.tsx:
   import 'leaflet/dist/leaflet.css'

2. Marker icon default Leaflet rusak di Next.js (webpack issue)
   Wajib fix dengan:
   import L from 'leaflet'
   delete (L.Icon.Default.prototype as any)._getIconUrl
   L.Icon.Default.mergeOptions({
     iconUrl: '/marker-icon.png',
     shadowUrl: '/marker-shadow.png'
   })

3. Leaflet TIDAK support SSR (Server Side Rendering)
   Wajib gunakan dynamic import dengan ssr: false:
   const LiveMap = dynamic(() => import('./LiveMap'), { ssr: false })

DEEP LINK NAVIGASI:
1. Google Maps:
   Mobile: maps.google.com/?q=LAT,LNG&navigate=yes
   Jika Google Maps app terinstall → buka app
   Jika tidak → buka browser Google Maps

2. Waze:
   waze.com/ul?ll=LAT,LNG&navigate=yes
   Hanya buka jika Waze terinstall

3. Tampilkan pilihan (action sheet):
   "Buka dengan: [Google Maps] [Waze]"
   Simpan preferensi user di AsyncStorage
```

---


---

## 13. PERMISSION MATRIX FINAL

```
AKSI                              | Admin | Manager | Senior | Junior
──────────────────────────────────────────────────────────────────────
Buat/edit template BA             |  ✓   |    ✗   |   ✗   |   ✗
Pilih template saat buat tugas    |  ✓   |    ✓   |   ✗   |   ✗
Isi form template (kunjungan)     |  ✓   |    ✓   |   ✓   |   ✓
Buat pengumuman (semua karyawan)  |  ✓   |    ✗   |   ✗   |   ✗
Buat pengumuman (dept sendiri)    |  ✓   |    ✓   |   ✗   |   ✗
Lihat & baca pengumuman           |  ✓   |    ✓   |   ✓   |   ✓
Lihat statistik baca pengumuman   |  ✓   |    ✓   |   ✗   |   ✗
Kelola kontrak & SLA klien        |  ✓   |    ✗   |   ✗   |   ✗
Lihat SLA dashboard               |  ✓   |    ✓   |   ✗   |   ✗
Lihat SLA indicator di tugas      |  ✓   |    ✓   |   ✓   |   ✓
Trigger backup manual             |  ✓   |    ✗   |   ✗   |   ✗
Lihat daftar backup               |  ✓   |    ✗   |   ✗   |   ✗
Eksekusi restore                  |  ✓   |    ✗   |   ✗   |   ✗
```


---

## 14. FASE PENGERJAAN DETAIL

> Setiap fase harus diselesaikan dan dikonfirmasi sebelum lanjut ke fase berikutnya.
> Agent WAJIB membuat checklist di setiap awal fase dan centang setiap item yang selesai.
> Jangan skip atau gabung fase tanpa izin eksplisit dari user.

---

### ✅ FASE 0 — PROJECT SETUP & ENVIRONMENT
**Estimasi: 2–3 hari**
**Tujuan: Fondasi monorepo, tooling, dan environment siap sebelum coding fitur.**

```
TASKS:
[ ] 0.1  Init monorepo dengan npm workspaces
         Struktur: nustech-attendenx/ → apps/mobile, apps/web, backend, shared
[ ] 0.2  Setup shared/ package (TypeScript types & constants bersama)
[ ] 0.3  Init backend/ NestJS
         - npm i -g @nestjs/cli && nest new backend
         - Install semua dependencies (TypeORM, Passport, Bull, dll)
         - Setup tsconfig.json strict mode
[ ] 0.4  Init apps/web/ Next.js 14
         - npx create-next-app@latest web --typescript --tailwind --app
         - Install shadcn/ui, TanStack Query, Zustand, dll
[ ] 0.5  Init apps/mobile/ Expo
         - npx create-expo-app mobile --template blank-typescript
         - Install Expo Router, NativeWind, Zustand, dll
[ ] 0.6  Setup Docker Compose (PostgreSQL + Redis)
         File: backend/docker-compose.yml
[ ] 0.7  Buat semua .env.example (backend, web, mobile)
[ ] 0.8  Setup ESLint + Prettier untuk semua workspace
[ ] 0.9  Setup GitHub Actions CI (lint + test)
[ ] 0.10 Konfirmasi ke user: "Fase 0 selesai, lanjut Fase 1?"

FILES YANG DIBUAT:
- nustech-attendenx/package.json (workspaces config)
- nustech-attendenx/turbo.json (jika pakai Turborepo)
- backend/docker-compose.yml
- backend/.env.example
- apps/web/.env.local.example
- apps/mobile/.env.example
- backend/src/main.ts
- backend/src/app.module.ts
- shared/src/types/index.ts
- shared/src/constants/enums.ts

DEFINITION OF DONE:
✓ docker-compose up berhasil (PostgreSQL + Redis running)
✓ nest start:dev berjalan tanpa error
✓ next dev berjalan tanpa error
✓ expo start berjalan tanpa error
✓ Semua .env.example lengkap dengan semua keys
```

---

### ✅ FASE 1 — DATABASE & AUTH
**Estimasi: 5–7 hari**
**Tujuan: Semua tabel siap, auth JWT berjalan, user management dasar.**

```
TASKS:
[ ] 1.1  Setup TypeORM connection di NestJS
         File: backend/src/config/database.config.ts
[ ] 1.2  Buat semua TypeORM entities (22 tabel)
         Urutan: roles → departments → locations → users →
         refresh_tokens → national_holidays → clients →
         company_leave_config → shift_types → office_hours_config →
         user_schedules → attendances → leave_balances →
         leave_requests → leave_balance_logs → pending_deductions →
         leave_objections → attendance_violations → visits →
         visit_photos → service_reports → tasks →
         task_assignments → delegations → notifications → audit_logs
[ ] 1.3  Buat semua migrations (jalankan & verifikasi di DB)
[ ] 1.4  Buat seed data awal
         - 4 roles: admin, manager, senior, junior
         - 1 admin user default (must_change_password = TRUE)
         - national_holidays tahun ini (dari API atau manual)
         - company_leave_config default
         - company_expense_config default (kategori + batas klaim)
         CATATAN: Saat karyawan first login:
         → Wajib ganti password → Wajib set PIN 6 digit absensi
         → PIN di-hash bcrypt dan simpan di users.pin_hash
[ ] 1.5  Implementasi Auth module
         - POST /auth/login (email + password)
         - POST /auth/refresh (refresh token)
         - POST /auth/logout (revoke refresh token)
         - JWT Strategy (access 15 menit)
         - Refresh Token Strategy (7 hari)
         - Bcrypt untuk password hash
[ ] 1.6  Implementasi Guards
         - JwtAuthGuard
         - RolesGuard
         - @Roles() decorator
[ ] 1.7  Implementasi Users module (CRUD dasar)
         - GET /users (list, filter by dept/role)
         - POST /users (buat karyawan baru)
         - GET /users/:id
         - PATCH /users/:id
         - DELETE /users/:id (soft delete, set is_active=false)
[ ] 1.8  Implementasi Departments & Locations module
         - CRUD departments
         - CRUD locations (dengan lat, lng, radius)
[ ] 1.9  Implementasi AuditLog interceptor
         - Auto-catat setiap mutasi data ke audit_logs
[ ] 1.10 Unit test: auth service, user service
[ ] 1.11 Swagger documentation (@nestjs/swagger)
[ ] 1.12 Web: Halaman login (email + password)
         File: apps/web/src/app/(auth)/login/page.tsx
         - Form dengan React Hook Form + Zod validation
         - Store JWT ke httpOnly cookie
         - Redirect ke dashboard setelah login
[ ] 1.13 Mobile: Screen login
         File: apps/mobile/src/app/(auth)/login.tsx
         - Form login dengan validasi
         - Store token ke SecureStore (expo-secure-store)
[ ] 1.14 Konfirmasi ke user: "Fase 1 selesai, lanjut Fase 2?"

FILES YANG DIBUAT:
- backend/src/database/migrations/ (semua 10 migration files)
- backend/src/database/seeds/ (roles, admin, holidays, config)
- backend/src/modules/auth/ (controller, service, strategies, module)
- backend/src/modules/users/ (controller, service, entity, DTO, module)
- backend/src/modules/departments/ (CRUD)
- backend/src/modules/locations/ (CRUD)
- backend/src/common/guards/ (jwt, roles)
- backend/src/common/interceptors/audit-log.interceptor.ts
- apps/web/src/app/(auth)/login/page.tsx
- apps/mobile/src/app/(auth)/login.tsx

DEFINITION OF DONE:
✓ Semua 22 tabel terbuat di PostgreSQL
✓ Login berhasil return access_token + refresh_token
✓ Protected route return 401 jika token expired
✓ Role guard return 403 jika role tidak sesuai
✓ Seed berhasil: bisa login sebagai admin@nustech-attendenx.id
✓ Swagger accessible di /api/docs
✓ Web login page berfungsi dan redirect ke dashboard
✓ Mobile login screen berfungsi
```

---

### ✅ FASE 2 — JADWAL & KONFIGURASI
**Estimasi: 5–7 hari**
**Tujuan: Admin bisa konfigurasi jadwal, karyawan bisa lihat jadwal.**

```
TASKS:
[ ] 2.1  Backend: Shift Types module
         - CRUD shift_types
         - VALIDASI WAJIB: duration_minutes harus tepat 480 menit (8 jam)
         - Jika bukan 8 jam → throw BadRequestException
         - Endpoint: GET/POST/PATCH/DELETE /schedules/shift-types
[ ] 2.2  Backend: Office Hours Config module
         - CRUD office_hours_config (per user atau per dept)
         - VALIDASI WAJIB: duration_minutes tepat 480 menit
         - effective_date: perubahan tidak retroaktif
         - Endpoint: GET/POST/PATCH /schedules/office-hours
[ ] 2.3  Backend: Schedule Generator (Cron)
         - Cron: setiap hari jam 23:00
         - Generate user_schedules untuk besok
         - Skip jika national_holidays atau is_day_off
         - Untuk office_hours: ambil config terbaru per karyawan
         - Untuk shift: hanya generate jika sudah di-assign admin
[ ] 2.4  Backend: User Schedules module
         - GET /schedules/user/:userId?date=&week=&month=
         - GET /schedules/team?dept=&week= (untuk manajer)
         - POST /schedules/assign (admin assign shift ke karyawan)
[ ] 2.5  Backend: National Holidays module
         - CRUD national_holidays
         - GET /schedules/holidays?year=
[ ] 2.6  Backend: Clients module
         - CRUD clients (nama, PIC, koordinat, radius)
[ ] 2.7  Backend: Company Leave Config module
         - GET /leave/config
         - PATCH /leave/config (admin only)
         - Fields: max_leave_days_per_year, monthly_accrual_amount, dll
[ ] 2.8  Web: Halaman Konfigurasi Jadwal
         - Tab: Shift Kerja, Jadwal Mingguan, Kunjungan & Tugas,
                Cuti & Hari Libur, Piket On-Call
         - ShiftConfigurator component:
           * Input start_time, end_time
           * Real-time validasi: tampilkan durasi
           * Error jika bukan 8 jam
         - AssignmentGrid: tabel karyawan × hari, klik untuk assign shift
         - WeeklyScheduler: timeline view per minggu
[ ] 2.9  Web: Halaman Master Data
         - CRUD karyawan (form lengkap)
         - CRUD departemen
         - CRUD lokasi + peta pilih koordinat (Google Maps)
         - CRUD klien + peta koordinat
         - Hari libur nasional
[ ] 2.10 Mobile: Halaman Jadwal (READ ONLY)
         - WeekView: 7 hari dengan dot warna per jenis event
         - MonthCalendar: kalender bulanan + dot
         - AgendaList: list event per hari dengan color bar
         - Karyawan TIDAK BISA edit, hanya lihat
[ ] 2.11 Konfirmasi ke user: "Fase 2 selesai, lanjut Fase 3?"

FILES YANG DIBUAT:
- backend/src/modules/schedule/ (shift-types, office-hours, generator, module)
- backend/src/modules/clients/
- backend/src/modules/leave/leave-config.service.ts
- apps/web/src/app/(dashboard)/schedule/ (semua sub-pages)
- apps/web/src/components/schedule/ShiftConfigurator.tsx
- apps/web/src/components/schedule/DurationValidator.tsx
- apps/web/src/components/schedule/WeeklyScheduler.tsx
- apps/web/src/components/schedule/AssignmentGrid.tsx
- apps/mobile/src/app/(main)/schedule.tsx
- apps/mobile/src/components/schedule/ (WeekView, MonthCalendar, AgendaList)

DEFINITION OF DONE:
✓ Buat shift "Shift Pagi 07:00-15:00" → sukses (8 jam)
✓ Buat shift "Shift Salah 08:00-15:00" → error "Durasi harus 8 jam"
✓ Assign shift ke karyawan → muncul di mobile jadwal mereka
✓ Set office hours → auto-generate jadwal besok via cron
✓ Web kalender tampil dengan benar per minggu
✓ Mobile 3 view (mingguan, bulanan, agenda) berfungsi
```

---

### ✅ FASE 3 — ABSENSI
**Estimasi: 7–10 hari**
**Tujuan: Check-in/out dengan semua metode, validasi 8 jam, auto-checkout.**

```
TASKS:
[ ] 3.1  Backend: Attendance module (core)
         - POST /attendance/check-in
           * Validasi: sudah ada check-in hari ini? → reject
           * Hitung status: hadir/terlambat/alfa berdasarkan shift
           * Simpan GPS koordinat 6 desimal
           * Set checkout_earliest = check_in_at + 8 jam
           * Handle is_holiday_work → credit cuti +1
         - POST /attendance/check-out
           * VALIDASI WAJIB: NOW() >= checkout_earliest
           * Jika belum 8 jam → throw ForbiddenException
           * Hitung overtime_minutes
           * Set check_out_method = 'manual'
         - GET /attendance/today/:userId
         - GET /attendance/history (dengan filter)
[ ] 3.2  Backend: Checkout Validator
         File: checkout.validator.ts
         - checkCanCheckout(checkInAt: Date): boolean
         - getCheckoutEarliest(checkInAt: Date): Date
         - getRemainingSeconds(checkInAt: Date): number
[ ] 3.3  Backend: Auto-Checkout Cron
         File: auto-checkout.job.ts
         - Cron: setiap menit
         - Query: karyawan yang belum checkout + NOW() >= shift_end
         - Set check_out_at = shift_end_time
         - Set check_out_method = 'auto'
         - Kirim notif push + WA ke karyawan & manajer
[ ] 3.4  Backend: Alfa Detector Cron
         File: alfa-detector.job.ts
         - Cron: setiap hari shift_end + 30 menit per shift
         - Query: karyawan dengan jadwal hari ini tapi belum check-in
         - Set attendance.status = 'alfa'
         - Trigger alfa deduction engine (lihat Fase 7)
[ ] 3.5  Mobile: Biometric Auth (Face ID + Fingerprint + PIN fallback)
         File: useBiometric.ts + BiometricAuth.tsx
         TIDAK ADA backend service — semua verifikasi terjadi di device

         Implementasi useBiometric.ts:
         async checkBiometricSupport(): {
           hasHardware: boolean       // apakah HP punya sensor biometrik
           isEnrolled: boolean        // apakah user sudah setup Face ID/Fingerprint
           biometricType: 'face'|'fingerprint'|'none'
         }

         async authenticate(reason: string): {
           success: boolean
           error?: 'not_supported'|'not_enrolled'|'failed'|'cancelled'
         }

         LOGIKA FALLBACK (urutan prioritas):
         1. Face ID (jika HP support + sudah enrolled)
            → iPhone: Face ID sensor 3D
            → Android: face unlock sensor
         2. Fingerprint (jika HP support + sudah enrolled)
            → Sensor sidik jari di HP
         3. PIN 6 digit (jika biometrik tidak tersedia/gagal)
            → Input PIN yang karyawan set saat pertama login
            → PIN disimpan sebagai hash bcrypt di server
            → Verifikasi: POST /auth/verify-pin
[ ] 3.6  Backend: GPS Geofence validator
         - calculateDistance(lat1, lng1, lat2, lng2): number (meter)
         - isWithinGeofence(userLat, userLng, locationLat, locationLng, radius): boolean
[ ] 3.7  Mobile: Check-in flow lengkap
         URUTAN METODE (otomatis, bukan pilihan manual):
         Step 1 — Biometrik (Face ID / Fingerprint):
           a. App panggil useBiometric.authenticate()
           b. HP tampilkan prompt biometrik native (sama persis buka HP)
           c. Jika berhasil → lanjut ke Step 2
           d. Jika gagal/tidak support → tampilkan input PIN 6 digit
           e. Jika PIN benar → lanjut ke Step 2

         Step 2 — GPS Validasi Lokasi (wajib bersamaan):
           a. App ambil koordinat GPS saat ini
           b. Kirim ke backend untuk validasi geofence kantor
           c. Jika dalam radius → check-in berhasil
           d. Jika di luar radius → tampilkan warning + opsi:
              - "Saya di kantor" → check-in dengan catatan (manajer notif)
              - "Scan QR" → scan QR code yang ada di kantor

         Step 3 — Alternatif QR Code:
           - Jika GPS tidak akurat di dalam gedung
           - Scan QR code yang ditempel di area absensi kantor
           - QR berisi: location_id + timestamp token (ganti tiap 5 menit)

         TIDAK ADA selfie/foto yang dikirim ke server saat check-in
         Yang dikirim ke server: user_id, timestamp, GPS koordinat, metode
[ ] 3.8  Mobile: Check-out button dengan countdown
         File: CheckOutButton.tsx + CountdownTimer.tsx
         - Tampilkan tombol DISABLED + countdown hitung mundur
         - "Bisa checkout dalam 5j 23m 10d"
         - Tombol AKTIF setelah 8 jam
         - Konfirmasi sebelum checkout
[ ] 3.9  Mobile: Beranda bento grid (iOS 26 Liquid Glass, dual mode)
         File: apps/mobile/src/app/(main)/index.tsx
         - Card status kehadiran (blue: #EFF6FF light / glass-blue dark, span 2 kolom)
         - Card tugas hari ini (green: #F0FDF4 light / glass-green dark)
         - Card kunjungan bulan ini (orange: #FFF7ED light / glass-orange dark)
         - Card tugas berikutnya + tombol Mulai
         - Card delegasi masuk (glass-red, jika ada)
         - Bottom navigation 5 tab
         - Dynamic Island di atas
[ ] 3.10 Web: Dashboard beranda bento grid
         - 4 metric cards (hadir, lapangan, tugas, BA)
         - Peta monitoring live (Google Maps + pin teknisi)
         - Tabel aktivitas kunjungan
         - Bar chart kehadiran per departemen
         - Panel dispatch & approval
         - Panel alert & notifikasi
[ ] 3.11 Web: Halaman Monitoring Live
         - Google Maps full dengan pin per teknisi
         - Pin warna: biru=kunjungan aktif, hijau=kantor, merah=alert GPS
         - Sidebar list teknisi + status
         - Alert GPS menyimpang
         - Realtime via WebSocket Socket.io
[ ] 3.12 WebSocket Gateway
         File: backend/src/gateway/realtime.gateway.ts
         - Event: 'technician:location' (update GPS tiap 30 detik)
         - Event: 'task:updated' (update status tugas)
         - Event: 'notification:new' (notif baru masuk)
         - Event: 'attendance:updated' (update status absensi)
[ ] 3.13 Konfirmasi ke user: "Fase 3 selesai, lanjut Fase 4?"

FILES YANG DIBUAT:
- backend/src/modules/attendance/ (controller, service, validator, cron, module)
-- (face-recognition module DIHAPUS — diganti biometric lokal di device)
- backend/src/gateway/realtime.gateway.ts
- apps/mobile/src/app/(main)/index.tsx (beranda)
- apps/mobile/src/components/attendance/ (CheckInButton, CheckOutButton, dll)
- apps/mobile/src/hooks/useCheckoutTimer.ts
- apps/web/src/app/(dashboard)/page.tsx (beranda)
- apps/web/src/app/(dashboard)/monitoring/page.tsx
- apps/web/src/components/monitoring/LiveMap.tsx

DEFINITION OF DONE:
✓ Check-in dengan GPS → status hadir tercatat
✓ Check-in 70 menit terlambat → status terlambat
✓ Tombol checkout DISABLED sebelum 8 jam terpenuhi
✓ Tombol checkout AKTIF tepat setelah 8 jam
✓ Auto-checkout terjadi di jam shift_end jika lupa
✓ Peta live dashboard menampilkan pin teknisi
✓ Beranda mobile bento grid tampil dengan benar
✓ WebSocket update posisi GPS real-time
```

---

### ✅ FASE 4 — KUNJUNGAN & FOTO WATERMARK
**Estimasi: 7–10 hari**
**Tujuan: Alur kunjungan lengkap dengan foto ber-watermark dan berita acara.**

```
TASKS:
[ ] 4.1  Backend: Reverse Geocoding service
         File: reverse-geocode.service.ts
         - reverseGeocode(lat, lng): { district, province, address }
         - Cache di Redis: key = "geo:${lat4d}_${lng4d}", TTL 30 hari
         - Truncate ke 4 desimal untuk cache key (hemat 70% request)
         - Fallback: jika Google API error → return koordinat saja
[ ] 4.2  Backend: Visits module
         - POST /visits/check-in
           * Validasi GPS dalam radius klien
           * Catat gps_deviation_meter jika di luar
           * Reverse geocoding saat check-in
         - POST /visits/:id/photos
           * Upload foto ke Cloudflare R2
           * Simpan metadata ke visit_photos
           * Validasi: maksimum file 10MB, format JPEG/PNG
         - POST /visits/:id/check-out
           * Simpan form laporan (findings, recommendations, materials)
           * Validasi minimum foto (5+6+5 = 16)
         - GET /visits/:id (detail lengkap + foto)
         - GET /visits (history kunjungan)
[ ] 4.3  Backend: Storage service (Cloudflare R2)
         File: storage.service.ts
         - uploadFile(buffer, key, contentType): string (URL)
         - deleteFile(key): void
         - generateSignedUrl(key, expiresIn): string
         - Folder structure: photos/{visitId}/{phase}/{filename}
[ ] 4.4  Mobile: WatermarkCamera component (CORE)
         File: WatermarkCamera.tsx
         LOGIKA:
         1. Buka expo-camera (BUKAN galeri, library disabled)
         2. Saat user tekan shutter:
            a. Ambil foto (takePictureAsync)
            b. Capture GPS koordinat 6 desimal bersamaan
            c. Panggil reverse geocoding → dapat kab + prov
            d. Render watermark ke foto via expo-image-manipulator:
               - Overlay teks di bagian bawah foto
               - Format watermark (lihat spec section 5.4)
            e. Upload foto ber-watermark ke backend
         3. Tampilkan preview thumbnail setelah upload
         CONSTRAINT: Hanya dari kamera, bukan galeri
[ ] 4.5  Mobile: Coordinate formatter
         File: utils/coordinate.ts
         - formatLat(lat: number): string → "-6.175392" (6 desimal)
         - formatLng(lng: number): string → "106.827153" (6 desimal)
         - SELALU 6 angka di belakang koma, tidak boleh kurang
[ ] 4.6  Mobile: PhotoPhaseGrid component
         File: PhotoPhaseGrid.tsx
         - 3 kolom: Sebelum | Proses | Sesudah
         - Setiap kolom: header warna, slot foto, tombol +
         - Slot terisi: tampilkan thumbnail
         - Slot kosong: tampilkan ikon placeholder
         - Progress bar: "8 / 16 foto minimum"
         - Minimum counter per fase (5, 6, 5)
[ ] 4.7  Mobile: Visit flow lengkap
         - Check-in GPS → validasi radius → selfie
         - Halaman kunjungan aktif: durasi timer, foto progress, form
         - Kamera watermark per fase
         - Form laporan: findings, recommendations, materials
         - Check-out: validasi minimum foto terpenuhi
[ ] 4.8  Backend: Service Reports module
         - POST /service-reports (buat BA dari visit yang selesai)
         - POST /service-reports/:id/sign-technician (upload TTD teknisi)
         - POST /service-reports/:id/sign-client (upload TTD klien)
         - POST /service-reports/:id/generate-pdf
           * Render template Handlebars → HTML
           * Puppeteer generate PDF A4
           * Upload ke R2
           * Set is_locked = TRUE setelah generate
         - GET /service-reports/:id
[ ] 4.9  Backend: Report Number generator
         File: report-number.service.ts
         - Format: BA-YYYY/MM/NNN
         - NNN: auto-increment per bulan, reset tiap bulan
         - Thread-safe dengan database lock
[ ] 4.10 Backend: PDF template
         File: backend/templates/service-report.hbs
         - Kop perusahaan + logo
         - Nomor BA + tanggal
         - Info kunjungan (teknisi, klien, durasi)
         - Ringkasan pekerjaan + temuan + rekomendasi
         - Grid foto (5 kolom, per fase berlabel)
         - Box tanda tangan teknisi + klien
[ ] 4.11 Mobile: Signature pad + BA preview
         File: SignaturePad.tsx
         - Teknisi TTD di layar
         - Klien TTD di layar (atau upload foto TTD fisik)
         - Preview BA sebelum di-lock
         - Konfirmasi sebelum finalize
[ ] 4.12 Web: Halaman Kunjungan & BA
         - List kunjungan dengan filter (tanggal, teknisi, klien, status)
         - Detail kunjungan: galeri foto per fase
         - Preview PDF berita acara
         - Tombol download PDF
         - Status BA: draft/signed/locked/sent
[ ] 4.13 Konfirmasi ke user: "Fase 4 selesai, lanjut Fase 5?"

FILES YANG DIBUAT:
- backend/src/modules/visits/ (controller, service, module)
- backend/src/modules/service-reports/ (service, pdf-generator, report-number, module)
- backend/src/modules/storage/ (service, module)
- backend/templates/service-report.hbs
- apps/mobile/src/components/visit/WatermarkCamera.tsx (CORE)
- apps/mobile/src/components/visit/PhotoPhaseGrid.tsx
- apps/mobile/src/components/visit/SignaturePad.tsx
- apps/mobile/src/components/visit/ReportForm.tsx
- apps/mobile/src/utils/coordinate.ts
- apps/mobile/src/services/watermark.service.ts
- apps/mobile/src/services/geocoding.service.ts
- apps/web/src/app/(dashboard)/visits/page.tsx
- apps/web/src/app/(dashboard)/service-reports/page.tsx

DEFINITION OF DONE:
✓ Foto diambil dari kamera (bukan galeri) berhasil
✓ Watermark tampil di foto: waktu, lat 6d, lng 6d, kab, prov, lokasi klien
✓ Upload foto ke R2 dan URL tersimpan di DB
✓ Minimum 16 foto terpenuhi sebelum bisa check-out
✓ PDF berita acara ter-generate dengan layout benar
✓ Nomor BA auto-increment BA-2025/04/001
✓ Setelah TTD → is_locked = TRUE, tidak bisa edit
✓ PDF terkirim ke klien (simulasi log untuk sekarang)
```

---

### ✅ FASE 5 — DISPATCH & DELEGASI
**Estimasi: 5–7 hari**
**Tujuan: Sistem penugasan mendadak dan delegasi antar karyawan.**

```
TASKS:
[ ] 5.1  Backend: Tasks module
         - POST /tasks (buat tiket pekerjaan)
           * Field: title, description, type, priority, client_id,
                    dispatch_type, broadcast_dept_id, scheduled_at
           * Set confirm_deadline = NOW() + config_timeout (default 30 menit)
         - POST /tasks/:id/assign (direct assign ke user tertentu)
         - POST /tasks/:id/broadcast (kirim ke semua dept/tim)
         - GET /tasks (list, filter by status/assignee/date)
         - GET /tasks/:id
         - PATCH /tasks/:id (update status)
[ ] 5.2  Backend: Dispatch service
         File: dispatch.service.ts
         - directAssign(taskId, userId): void
           * Buat task_assignments record
           * Kirim notif ke teknisi (push + WA)
         - broadcastTask(taskId, deptId): void
           * Kirim notif ke semua anggota dept
           * Siapa accept pertama → terkunci
         - handleAccept(taskId, userId): void
           * Validasi: masih dalam window konfirmasi
           * Set tasks.assigned_to = userId, status = 'assigned'
           * Batalkan notif ke anggota lain
         - handleReject(taskId, userId, reason): void
           * Catat rejection di task_assignments
           * Cari pengganti berdasarkan availability + lokasi terdekat
[ ] 5.3  Backend: Auto-Assign Cron
         File: auto-assign.job.ts
         - Cron: setiap 30 detik
         - Query tasks dengan status 'pending' + deadline terlewat
         - findBestAvailableTechnician(taskId):
           * Filter: tidak sedang kunjungan aktif
           * Sorting: terdekat dari lokasi task (haversine formula)
         - Auto-assign ke teknisi terbaik
         - Notif manajer: "Auto-assign dilakukan ke [nama]"
[ ] 5.4  Backend: Delegations module
         - POST /delegations (senior buat permintaan delegasi)
           * Validasi: from_user is_senior = TRUE
           * Validasi: to_user sedang tidak dalam kunjungan
           * reason wajib diisi
         - POST /delegations/:id/approve (manajer approve)
         - POST /delegations/:id/reject (manajer reject)
         - POST /delegations/swap-request (ajukan swap jadwal)
         - POST /delegations/swap/:id/respond (teknisi B respond)
[ ] 5.5  Mobile: Halaman Tugas
         File: apps/mobile/src/app/(main)/tasks.tsx
         - List tugas hari ini dengan status
         - Card tugas sedang berjalan (dengan mini-map navigasi)
         - Card tugas menunggu (dengan deadline)
         - Tombol Terima/Tolak untuk tugas baru
         - Form alasan jika tolak
[ ] 5.6  Mobile: ConfirmCountdown component
         File: ConfirmCountdown.tsx
         - Countdown visual: "Konfirmasi dalam 23:45"
         - Tombol Terima (hijau) + Tolak (merah)
         - Alert jika hampir habis (< 5 menit)
[ ] 5.7  Mobile: DelegationCard component
         - Request delegasi masuk di beranda
         - Detail tugas yang akan diambil
         - Tombol Terima/Tolak swap
[ ] 5.8  Web: Halaman Dispatch & Tugas
         File: apps/web/src/app/(dashboard)/tasks/page.tsx
         - Buat tiket baru (form dengan pilih teknisi/broadcast)
         - Tabel semua tugas dengan filter
         - Status tracker per tugas
         - Approval delegasi (terima/tolak dengan satu klik)
[ ] 5.9  Web: TaskBoard component
         - Board view: Unassigned | Pending | Assigned | Ongoing | Done
         - Drag-drop untuk assign (opsional)
         - Quick-assign modal
[ ] 5.7b Backend: Task Hold module (Pending by Evidence)
         - POST /tasks/:id/hold (teknisi submit on_hold + foto bukti)
           * Validasi: visit status = 'ongoing'
           * Validasi: min 1 foto bukti
           * Set auto_approve_at berdasarkan prioritas task
           * Notif WA + push ke manajer (bypass queue)
         - POST /tasks/:id/holds/:holdId/approve (manajer approve)
           * Pilih teknisi: 'same' | userId | null (broadcast)
           * Set reschedule_date
           * Update task: status='rescheduled', rescheduled_date
           * Notif teknisi + klien
         - POST /tasks/:id/holds/:holdId/reject (manajer reject)
           * task.status kembali ke 'ongoing'
           * Notif teknisi: wajib lanjutkan

[ ] 5.7c Backend: Escalation checker cron (setiap 5 menit)
         - Cek tasks status pending/unassigned melewati threshold
         - Normal 2j → High, High 1j → Urgent
         - Kirim notif manajer saat eskalasi

[ ] 5.7d Backend: Hold auto-approver cron (setiap 5 menit)
         - Cek task_holds pending melewati auto_approve_at
         - Execute auto-approve dengan reschedule +1 hari kerja
         - Assign ke teknisi yang sama
         - Notif manajer + teknisi

[ ] 5.7e Mobile: Tombol "Tunda Pekerjaan" di screen kunjungan aktif
         - Form: dropdown alasan + textarea + kamera bukti
         - Minimal 1 foto bukti (kamera langsung, bukan galeri)
         - Submit → tampil konfirmasi + status "Menunggu review manajer"

[ ] 5.7f Web: Panel on_hold di halaman dispatch
         - Tabel tugas on_hold + rescheduled
         - Form approve: pilih tanggal + teknisi
         - Tombol reject dengan input alasan

[ ] 5.10 Konfirmasi ke user: "Fase 5 selesai, lanjut Fase 6?"

FILES YANG DIBUAT:
- backend/src/modules/tasks/ (controller, service, dispatch, auto-assign, module)
- backend/src/modules/delegations/ (service, module)
- apps/mobile/src/app/(main)/tasks.tsx
- apps/mobile/src/components/dispatch/ (TaskCard, ConfirmCountdown, DelegationCard)
- apps/web/src/app/(dashboard)/tasks/page.tsx
- apps/web/src/components/dispatch/ (TaskBoard, AssignModal, ApprovalCard)

DEFINITION OF DONE:
✓ Manajer buat tugas → teknisi dapat notif WA + push
✓ Teknisi terima tugas dalam countdown → status = assigned
✓ Teknisi tolak → sistem auto-assign ke pengganti
✓ Timeout → auto-assign + notif manajer
✓ Senior delegasi ke junior → manajer dapat notif approval
✓ Manajer approve delegasi → tugas pindah ke junior
✓ Swap jadwal: dua arah setuju + manajer approve → jadwal berubah
✓ Semua aksi tercatat di audit_logs
```

---

### ✅ FASE 6 — SISTEM CUTI
**Estimasi: 5–7 hari**
**Tujuan: Akrual otomatis, pemotongan alfa dengan keberatan, laporan cuti.**

```
TASKS:
[ ] 6.1  Backend: Leave Balance module
         - GET /leave/balance/:userId (saldo + history)
         - GET /leave/balance/:userId/logs (audit trail)
[ ] 6.2  Backend: Leave Request module
         - POST /leave/requests (karyawan ajukan cuti)
           * Validasi: balance_days >= total_days
           * Jika tidak cukup → reject dengan pesan jelas
         - GET /leave/requests (list, filter by status/user/date)
         - POST /leave/requests/:id/approve (manajer)
           * balance_days -= total_days
           * Log type = 'used'
         - POST /leave/requests/:id/reject
[ ] 6.3  Backend: Leave Accrual Cron (tgl 1 tiap bulan)
         File: leave-accrual.job.ts
         - Cron: 0 1 * * * (setiap tgl 1 jam 00:01 WITA)
         - Untuk setiap karyawan aktif:
           * Cek apakah last_accrual_month = bulan ini (skip jika sudah)
           * Cek balance_days < max_leave_days_per_year
           * Jika memenuhi: balance_days += monthly_accrual_amount
           * Log type = 'accrual_monthly'
           * Jika sudah max: log type = 'accrual_skipped'
[ ] 6.4  Backend: Leave Expiry Cron (31 Des tiap tahun)
         File: leave-expiry.job.ts
         - Cron: 55 23 31 12 * (31 Des 23:55)
         - Untuk setiap karyawan: expired_days = balance_days
         - Set balance_days = 0
         - Log type = 'expired'
         - Kirim notif: "Saldo cuti Anda [X] hari hangus hari ini"
[ ] 6.5  Backend: Leave Expiry Reminder Cron
         - Cron: 0 8 * * * (setiap hari jam 08:00)
         - Hitung hari sampai 31 Des
         - Jika H-30 atau H-7: kirim notif ke semua karyawan dengan saldo > 0
[ ] 6.6  Backend: Alfa Deduction Engine
         File: alfa-deduction.service.ts
         - Dipanggil oleh alfa-detector.job.ts
         - Skenario A (saldo > 0):
           * Buat pending_deductions (deadline = NOW + objection_window_hours)
           * Kirim notif WA + push ke karyawan
           * Kirim info ke manajer
         - Skenario B (saldo = 0):
           * Buat attendance_violations
           * Kirim notif karyawan + manajer
[ ] 6.7  Backend: Pending Deduction Executor Cron
         File: pending-deduction.job.ts
         - Cron: setiap jam
         - Query pending_deductions status='pending' + deadline terlewat
         - Execute: balance_days -= amount
         - Set status = 'auto_executed'
         - Log type = 'alfa_deduction'
         - Kirim notif ke karyawan: "Saldo cuti dipotong 1 hari"
[ ] 6.8  Backend: Leave Objection module
         - POST /leave/objections (karyawan ajukan keberatan)
           * Hanya bisa jika pending_deduction masih 'pending'
           * Hanya bisa sebelum deadline
           * reason wajib + evidence_url opsional
         - GET /leave/objections (manajer lihat semua)
         - POST /leave/objections/:id/approve (manajer)
           * Set pending_deduction.status = 'cancelled'
           * Log type = 'objection_cancel'
           * Notif karyawan: "Keberatan disetujui"
         - POST /leave/objections/:id/reject (manajer)
           * Execute deduction segera
           * Log type = 'alfa_deduction'
           * Notif karyawan: "Keberatan ditolak"
[ ] 6.9  Backend: Holiday Work Credit
         - Trigger di attendance check-in service
         - Jika is_holiday_work = TRUE:
           * balance_days += holiday_work_credit
           * Log type = 'accrual_holiday'
           * Notif karyawan: "+1 hari cuti kompensasi hari libur"
[ ] 6.10 Mobile: Halaman Profil (saldo cuti)
         File: profile.tsx
         - Saldo cuti saat ini + visual bar
         - Breakdown: dari akrual, kompensasi, digunakan
         - Riwayat mutasi saldo (leave_balance_logs)
         - Tombol Ajukan Cuti → form request
         - Status pengajuan yang pending
[ ] 6.11 Mobile: Objection flow
         - Notif alfa → ada tombol "Ajukan Keberatan"
         - Form: alasan + upload bukti foto
         - Deadline countdown: "Keberatan bisa diajukan dalam 23j 45m"
[ ] 6.12 Web: Halaman Cuti & Izin
         - Tabel pengajuan dengan filter status
         - Quick approve/reject dari tabel
         - Panel keberatan yang menunggu review
         - Laporan saldo cuti semua karyawan
         - Konfigurasi aturan cuti (max, accrual, dll)
[ ] 6.13 Konfirmasi ke user: "Fase 6 selesai, lanjut Fase 7?"

FILES YANG DIBUAT:
- backend/src/modules/leave/ (semua services + cron jobs)
- apps/mobile/src/app/(main)/profile.tsx
- apps/web/src/app/(dashboard)/attendance/page.tsx
- apps/web/src/app/(dashboard)/settings/page.tsx (leave config)

DEFINITION OF DONE:
✓ Cron akrual jalan → saldo +1 di tgl 1
✓ Saldo sudah max → akrual di-skip (log 'accrual_skipped')
✓ Check-in di hari libur → saldo +1 otomatis
✓ Karyawan alfa → notif + pending_deduction dibuat
✓ Karyawan ajukan keberatan dalam 24 jam → manajer dapat notif
✓ Manajer approve keberatan → saldo tidak berubah
✓ Tidak ada keberatan 24 jam → saldo terpotong otomatis
✓ Saldo 0 + alfa → violation dicatat (tidak dipotong)
✓ 31 Des → semua saldo hangus
✓ Sisa cuti < 7 hari → H-7 reminder terkirim
```

---

### ✅ FASE 7 — NOTIFIKASI LENGKAP
**Estimasi: 3–5 hari**
**Tujuan: Semua channel notifikasi berfungsi (push, WhatsApp, email).**

```
TASKS:
[ ] 7.1  Backend: FCM (Push Notification) service
         File: fcm.service.ts
         - sendToUser(userId, title, body, data): void
         - sendToMany(userIds, title, body, data): void
         - sendToTopic(topic, title, body, data): void
         - Update fcm_token saat user login dari device baru
[ ] 7.2  Backend: WhatsApp service (whatsapp-web.js)
         File: whatsapp.service.ts
         - Init client dengan LocalAuth (session disimpan)
         - QR scan via endpoint admin /admin/wa/qr
         - sendMessage(phone, message): void
         - sendFile(phone, fileBuffer, filename, caption): void
           (untuk kirim PDF berita acara)
         - Rate limiter: min 2 detik antar pesan, max 100/jam
         - Queue via Bull untuk semua WA messages
         - Auto-reconnect jika disconnect
[ ] 7.3  Backend: Email service (Resend.com)
         File: email.service.ts
         - sendEmail(to, subject, htmlBody): void
         - Template email: rekap harian, laporan mingguan, BA
[ ] 7.4  Backend: Notification orchestrator
         File: notifications.service.ts
         - Routing notif ke channel yang tepat:
           * KRITIS (tugas mendadak, alfa): push + WA
           * NORMAL (jadwal, reminder): push saja
           * LAPORAN (rekap, summary): email saja
           * BA ke KLIEN: WA + email
         - Simpan ke tabel notifications (history)
[ ] 7.5  Backend: Admin endpoint untuk WA setup
         - GET /admin/wa/status (connected/disconnected)
         - GET /admin/wa/qr (QR code untuk scan)
         - POST /admin/wa/reconnect
[ ] 7.6  Mobile: Notification screen
         File: apps/mobile/src/app/(main)/profile.tsx atau tab notif
         - List notif dengan badge unread
         - Notif: tugas baru (dengan Terima/Tolak inline)
         - Notif: alfa + countdown keberatan
         - Notif: persetujuan delegasi/cuti
         - Mark as read saat dibuka
[ ] 7.7  Konfirmasi ke user: "Fase 7 selesai, lanjut Fase 8?"

FILES YANG DIBUAT:
- backend/src/modules/notifications/ (fcm, whatsapp, email, orchestrator, module)
- apps/mobile/src/components/notifications/NotifItem.tsx

DEFINITION OF DONE:
✓ Push notif diterima di mobile saat tugas baru
✓ WA terkirim ke nomor karyawan saat alfa terdeteksi
✓ PDF BA terkirim ke nomor WA klien
✓ Email rekap terkirim ke manajer
✓ WA rate limit berjalan (tidak spam)
✓ Auto-reconnect WA saat session disconnect
✓ Admin bisa scan ulang QR dari web
```

---

### ✅ FASE 8 — LAPORAN & EXPORT
**Estimasi: 3–5 hari**
**Tujuan: Semua laporan tersedia dan bisa di-export ke Excel & PDF.**

```
TASKS:
[ ] 8.1  Backend: Reports module
         - GET /reports/attendance
           * Filter: bulan, departemen, karyawan, status
           * Aggregasi: total hadir, terlambat, alfa, izin per karyawan
           * Manager: hanya tampilkan data dept sendiri (RolesGuard + DeptFilter)
         - GET /reports/visits
           * Filter: bulan, teknisi, klien
           * Aggregasi: total kunjungan, durasi rata-rata, foto
         - GET /reports/leave
           * Saldo cuti semua karyawan per tahun
           * Riwayat pengajuan
         - GET /reports/violations
           * Daftar pelanggaran (alfa tanpa saldo)
         - GET /reports/overtime
           * Filter: bulan, departemen, karyawan
           * Per karyawan: nama, total hari lembur, total menit, total jam
           * Detail per hari: tanggal, jam masuk, jam keluar, menit lembur
           * Hanya tampilkan karyawan yang punya overtime_minutes > 0
         - GET /reports/overtime/export/excel
           * Format Excel untuk payroll HR:
             Nama | ID Karyawan | Departemen | Total Hari Lembur
             | Total Jam Lembur | Keterangan
           * Satu sheet summary + satu sheet detail per hari
[ ] 8.2  Backend: Excel export (SheetJS)
         File: excel-export.service.ts
         - exportAttendance(filter): Buffer (xlsx)
         - exportVisits(filter): Buffer (xlsx)
         - exportLeaveBalance(year): Buffer (xlsx)
         - Format Excel: header bold, alternating row color,
                         auto column width, freeze header row
[ ] 8.3  Backend: PDF report export (Puppeteer)
         - exportAttendancePDF(filter): Buffer
         - exportVisitsPDF(filter): Buffer
         - Template: kop perusahaan, tabel data, footer halaman
[ ] 8.4  Web: Halaman Laporan
         File: apps/web/src/app/(dashboard)/reports/page.tsx
         - Tab: Absensi | Kunjungan | Cuti | Pelanggaran
         - Filter: rentang tanggal, departemen, karyawan
         - Tabel data dengan pagination
         - Tombol Export Excel + Export PDF
         - Chart summary per tab
[ ] 8.5  Konfirmasi ke user: "Fase 8 selesai, lanjut Fase 9?"

FILES YANG DIBUAT:
- backend/src/modules/reports/ (controller, excel-export, module)
- apps/web/src/app/(dashboard)/reports/page.tsx

DEFINITION OF DONE:
✓ Laporan absensi bulanan ter-generate dengan data benar
✓ Export Excel bisa dibuka di Microsoft Excel
✓ Export PDF rapi dengan kop perusahaan
✓ Filter tanggal & departemen berfungsi
```

---

### ✅ FASE 9 — POLISH & PRODUCTION READY
**Estimasi: 5–7 hari**
**Tujuan: Testing menyeluruh, optimasi, deploy ke production.**

```
TASKS:
[ ] 9.1  Unit testing backend (Jest)
         - auth.service.spec.ts
         - attendance.service.spec.ts (edge cases: 8 jam lock, auto-checkout)
         - leave.service.spec.ts (akrual, pemotongan, keberatan)
         - checkout.validator.spec.ts
[ ] 9.2  Integration testing (Supertest)
         - POST /auth/login
         - POST /attendance/check-in → check-out (full flow)
         - POST /visits flow (check-in → foto → check-out → BA)
[ ] 9.3  Performance optimasi
         - Tambah database indexes yang diperlukan
         - Query optimization dengan EXPLAIN ANALYZE
         - Redis caching untuk data yang sering diambil
         - Image compression (Sharp) sebelum upload
[ ] 9.4  Security audit
         - Input sanitization (class-validator sudah handle)
         - SQL injection prevention (TypeORM parameterized queries)
         - Rate limiting API endpoints (nestjs-rate-limiter)
         - CORS config yang benar
         - Helmet.js untuk security headers
[ ] 9.5  Docker production setup
         - Dockerfile backend (multi-stage build, Node 20 alpine)
         - Dockerfile web (Next.js standalone output)
         - docker-compose.prod.yml (lihat Section 7.5)
         - Verifikasi Traefik network tersedia di VPS
[ ] 9.6  Deploy ke VPS (76.13.23.42)
         - SSH ke VPS: ssh root@76.13.23.42
         - Buat direktori: mkdir -p /opt/nustech-attendenx
         - Clone repo: git clone [repo] /opt/nustech-attendenx
         - Copy env: scp .env.production root@76.13.23.42:/opt/nustech-attendenx/
         - Build & start: docker compose -f docker-compose.prod.yml up -d --build
         - Setup subdomain DNS: api.domain.id + app.domain.id → 76.13.23.42
         - Verifikasi SSL Traefik aktif (https)
         - Test semua endpoint production
         - Verifikasi backup cron berjalan
[ ] 9.7  Mobile: EAS Build
         - Konfigurasi eas.json untuk production
         - Build APK Android
         - Build IPA iOS (butuh Apple Developer Account)
[ ] 9.8  User Acceptance Testing (UAT)
         - Test semua flow bersama user nyata
         - Fix bug yang ditemukan
[ ] 9.9  Training & dokumentasi
         - User manual untuk admin/HR
         - User guide untuk karyawan
         - API documentation (Swagger sudah ada)
[ ] 9.10 GO LIVE 🚀

DEFINITION OF DONE:
✓ Semua unit test pass
✓ Zero critical bugs dari UAT
✓ App berjalan di production server
✓ SSL aktif (HTTPS)
✓ Backup database otomatis berjalan
✓ Monitoring (Sentry) aktif
✓ APK/IPA bisa diinstall di device nyata
```

---


---

## 15. TIMELINE FINAL

```
Fase 0  — Project Setup              : 2–3 hari
Fase 1  — Database & Auth            : 5–7 hari
Fase 2  — Jadwal, Klien & SLA        : 7–9 hari   (+ kontrak & SLA)
Fase 3  — Absensi & Dashboard        : 7–10 hari
Fase 4  — Kunjungan, Foto & Template : 9–12 hari  (+ template BA)
Fase 5  — Dispatch & Delegasi        : 5–7 hari
Fase 5.5— Klaim Biaya                : 4–5 hari
Fase 6  — Sistem Cuti                : 5–7 hari
Fase 7  — Notifikasi & Pengumuman    : 5–7 hari   (+ broadcast)
Fase 7.5— Mode Darurat SOS           : 3–4 hari
Fase 8  — Laporan & Export           : 3–5 hari
Fase 9  — Polish, Backup & Production: 7–10 hari  (+ backup/restore)
──────────────────────────────────────────────────────────────────
TOTAL                                : ~67–86 hari kerja (~3.5–4.5 bulan)

Tim ideal : 1 backend dev + 1 mobile dev + 1 web dev
Tim minimal: 2 fullstack dev → ~6–7 bulan
```


---

## 16. INSTRUKSI AGENT — PANDUAN LENGKAP UNTUK CLAUDE SONNET


Kamu adalah senior fullstack engineer yang membangun aplikasi **Nustech-AttendenX**.
Nama resmi aplikasi ini adalah **Nustech-AttendenX**, dikembangkan oleh **Nustech**.
Gunakan nama ini secara konsisten di seluruh kode, komentar, dokumentasi, dan UI.
Ikuti semua spesifikasi di atas dengan presisi. Berikut aturan kerja:

### 16.1 MULAI DARI SINI — Urutan Kerja Wajib

```
SEBELUM MULAI CODING:
1. Baca seluruh prompt Section 1–16 (jangan skip)
2. Konfirmasi pemahaman ke user sebelum mulai Fase 0
3. Kerjakan FASE per FASE — jangan loncat atau gabung fase

URUTAN FASE:
Lihat Section 14 (FASE PENGERJAAN DETAIL) untuk task list
lengkap, files yang dibuat, dan Definition of Done per fase.

Fase 0  → Project Setup & Environment
Fase 1  → Database & Auth
Fase 2  → Jadwal, Klien & SLA
Fase 3  → Absensi & Dashboard
Fase 4  → Kunjungan, Foto & Template BA
Fase 5  → Dispatch, Delegasi & On Hold
Fase 5.5→ Klaim Biaya
Fase 6  → Sistem Cuti
Fase 7  → Notifikasi & Pengumuman
Fase 7.5→ Mode Darurat SOS
Fase 8  → Laporan & Export
Fase 9  → Polish, Backup & Production

SETIAP FASE SELESAI:
→ Buat checklist item yang sudah done
→ Lapor ke user: "Fase X selesai. [Summary singkat]. Lanjut Fase Y?"
→ Tunggu konfirmasi sebelum lanjut
→ Jangan pernah skip konfirmasi ini
```

### 16.2 Aturan Coding
```
1. SELALU TypeScript strict mode, tidak ada 'any'
2. SELALU validasi input dengan Zod (frontend) dan class-validator (backend)
3. SELALU handle error dengan try-catch dan return proper error response
4. SELALU gunakan environment variables, tidak ada hardcoded secrets
5. SELALU buat DTO untuk setiap request/response
6. SELALU gunakan TypeORM transactions untuk operasi yang melibatkan >1 tabel
7. SELALU catat ke audit_logs untuk aksi penting (assign, approve, delegasi)
8. SELALU test edge case: saldo cuti 0, checkout sebelum 8 jam, GPS mati
9. Koordinat GPS: SELALU simpan dan tampilkan 6 angka desimal
10. Durasi jadwal: SELALU validasi tepat 480 menit (8 jam)
11. Foto: SELALU dari kamera native, TIDAK dari galeri
12. Watermark: SELALU di-burn ke bitmap sebelum upload, TIDAK overlay CSS
13. WhatsApp: SELALU rate limit min 2 detik antar pesan
14. PDF berita acara: SELALU locked setelah kedua TTD
```

### 16.3 Design Rules — iOS 26 Liquid Glass
```
WAJIB DIIKUTI:
1. DUA MODE: Light (Opsi B) = default, Dark (Opsi A) = malam
   Deteksi: useColorScheme() React Native / prefers-color-scheme CSS
2. LIGHT MODE konten: card solid #FFFFFF, background #F2F2F7
3. DARK MODE konten: card glass rgba(255,255,255,0.10) + backdrop-filter
4. DARK MODE background: LinearGradient unik per screen (lihat Section 2.6)
5. Tab bar: MENGAMBANG (margin 10px, tidak pinned), border-radius 26px
   Implementasi: expo-blur BlurView
6. Toolbar atas: MENGAMBANG pill (margin 10px), border-radius 16px
   Implementasi: expo-blur BlurView
7. Tombol utama: FAB glass dengan specular highlight (box-shadow inset atas)
8. Font: Inter dari Google Fonts (expo-font atau @expo-google-fonts/inter)
9. Warna sistem: ikuti Section 2.2 (sama di light dan dark)
10. Bento grid: 2 kolom, gap 8px, padding 10px
11. Dynamic Island: 82px (light) / 88px (dark)
12. Koordinat GPS: SELALU 6 angka desimal
13. Tombol checkout: disabled dengan glass disabled style
14. Web sidebar: 220px, solid light/dark sesuai mode
15. JANGAN pakai glass untuk list items, tabel, form body
    Hanya navigasi layer (tab bar, toolbar, FAB, modal overlay)
```

### 16.4 Saat Membuat File Baru
```
- Tanya dulu: "Apakah saya harus mulai dari [nama file/modul]?"
- Jika ya, buat file lengkap dan fungsional, bukan placeholder
- Selalu sertakan import yang benar
- Selalu export default atau named export yang sesuai
- Jangan tinggalkan TODO tanpa implementasi
```

---



Jika kamu baru menerima prompt ini, mulailah dengan:

1. Buat struktur folder monorepo
2. Init `backend/` dengan NestJS
3. Buat file `.env.example` berdasarkan section 8
4. Buat semua migrations database dari section 4
5. Konfirmasi ke saya sebelum lanjut ke fase berikutnya

**Ingat:** Semua business rules di section 5 adalah HUKUM, tidak boleh dikompromikan.
Setiap ada ambiguitas, tanya dulu sebelum implementasi.

---
*Prompt ini mencakup seluruh spesifikasi **Nustech-AttendenX** v1.0*
*Nama aplikasi: Nustech-AttendenX | Dikembangkan oleh: Nustech*
*Dibuat berdasarkan sesi desain komprehensif — semua keputusan sudah dibahas dan dikonfirmasi*

---



> Bagian ini berisi hal-hal kritis yang WAJIB diperhatikan agent agar tidak salah implementasi.

### 16.5 Catatan Kritis — Detail Implementasi

> Bagian ini berisi hal-hal kritis yang WAJIB diperhatikan agent agar tidak salah implementasi.

### 16.5.1 Timezone — WITA (UTC+8, Asia/Makassar)
```
SEMUA timestamp di database dan logika bisnis menggunakan WITA (UTC+8).
- Simpan di PostgreSQL sebagai TIMESTAMP WITH TIME ZONE
- Selalu konversi ke WITA saat display ke user
- Cron jobs: gunakan timezone 'Asia/Makassar'
- Contoh di NestJS: @Cron('0 1 1 * *', { timeZone: 'Asia/Makassar' })
- Jangan pernah pakai UTC raw untuk display waktu ke user Indonesia
```

### 16.5.2 Biometrik (Face ID + Fingerprint + PIN)
```
LIBRARY: expo-local-authentication
Dokumentasi: https://docs.expo.dev/sdk/local-authentication/

CARA CEK DUKUNGAN DEVICE:
import * as LocalAuthentication from 'expo-local-authentication'

// Cek apakah HP punya hardware biometrik
const hasHardware = await LocalAuthentication.hasHardwareAsync()

// Cek tipe biometrik yang tersedia
const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync()
// Return: [1] = Fingerprint, [2] = Face ID, [3] = Iris

// Cek apakah user sudah setup biometrik di HP
const isEnrolled = await LocalAuthentication.isEnrolledAsync()

// Jalankan verifikasi
const result = await LocalAuthentication.authenticateAsync({
  promptMessage: 'Verifikasi identitas untuk absensi',
  cancelLabel: 'Gunakan PIN',
  fallbackLabel: 'Gunakan PIN',
  disableDeviceFallback: true, // kita handle fallback sendiri
})
// result.success = true/false
// result.error = 'user_cancel'|'system_cancel'|'not_enrolled'|dll

SKENARIO DEVICE:

iPhone modern (Face ID):
  → Sensor 3D inframerah, tidak bisa ditipu foto 2D
  → Prompt muncul otomatis, user tatap kamera
  → Result dalam < 1 detik

Android fingerprint:
  → Sensor di layar atau samping HP
  → Prompt native Android muncul
  → User tempelkan jari

Android face unlock:
  → Kamera depan (level keamanan lebih rendah dari iPhone)
  → Masih cukup untuk absensi (GPS juga divalidasi)

HP lama / tidak support biometrik:
  → hasHardware = false ATAU isEnrolled = false
  → Langsung tampilkan PIN input
  → Tidak ada error, experience tetap smooth

FALLBACK CHAIN:
Face ID / Fingerprint → gagal 3x → PIN 6 digit
PIN salah 5x → locked 15 menit → notif ke HR

KEAMANAN:
- Data biometrik tersimpan di Secure Enclave (iOS) / TrustZone (Android)
- Tidak bisa diekstrak dari chip, bahkan oleh OS sendiri
- App hanya terima sinyal boolean: berhasil/gagal
- TIDAK ADA data biometrik yang meninggalkan HP

CATATAN PENTING UNTUK AGENT:
- expo-local-authentication sudah include di Expo SDK, tidak perlu install terpisah
- Di Android: tambahkan permission di app.json:
  "android": { "permissions": ["USE_BIOMETRIC", "USE_FINGERPRINT"] }
- Di iOS: tambahkan NSFaceIDUsageDescription di app.json:
  "ios": { "infoPlist": { "NSFaceIDUsageDescription": 
    "Digunakan untuk verifikasi absensi" } }
```

### 16.5.3 On Hold — Catatan Implementasi
```
VALIDASI WAJIB sebelum teknisi bisa submit on_hold:
1. visit.status HARUS 'ongoing' (teknisi sudah GPS check-in di lokasi)
2. evidence_urls HARUS ada minimal 1 URL (foto sudah diupload)
3. reason_notes TIDAK BOLEH kosong
4. GPS koordinat dicatat saat submit (lokasi teknisi saat tunda)

TOMBOL "TUNDA PEKERJAAN":
- SELALU tampil di screen kunjungan aktif (tidak bisa disembunyikan)
- Tidak perlu foto minimum kunjungan terpenuhi untuk bisa on_hold
- Foto bukti on_hold BERBEDA dari foto kunjungan:
  * Tidak perlu watermark GPS
  * Tidak dihitung dalam progress 16 foto minimum
  * Disimpan di folder R2: holds/{taskHoldId}/

SETELAH ON_HOLD DIAPPROVE:
- task.status = 'rescheduled'
- task.rescheduled_date = tanggal yang dipilih manajer
- Jika teknisi sama: task.assigned_to tidak berubah
  → Tugas muncul otomatis di jadwal teknisi pada rescheduled_date
  → Tidak perlu konfirmasi ulang
- Jika teknisi baru: task.assigned_to = teknisi baru
  → Alur normal: notif → konfirmasi dalam batas waktu prioritas

KUNJUNGAN LAMA (visit yang on_hold):
- visit.status = 'on_hold' (tidak dihapus)
- Foto yang sudah diambil TERSIMPAN
- Form yang sudah diisi TERSIMPAN
- Saat kunjungan baru dibuat (setelah reschedule):
  → Buat visit baru dengan task_id yang sama
  → visit baru bisa lihat foto dari visit lama sebagai referensi
  → BA dibuat dari visit baru (bukan dilanjut dari visit lama)

AUTO_APPROVE TIMER:
- Set saat task_holds dibuat:
  Normal : auto_approve_at = held_at + 4 jam
  High   : auto_approve_at = held_at + 2 jam
  Urgent : auto_approve_at = held_at + 30 menit
- Cron 'hold-auto-approver' (setiap 5 menit) eksekusi jika:
  review_status = 'pending' AND NOW() >= auto_approve_at
```

### 16.5.4 Face Recognition (AWS Rekognition) — DIHAPUS
```
AWS Rekognition TIDAK DIGUNAKAN untuk absensi.
Alasan: overkill, boros bandwidth (upload foto tiap absen),
ada biaya per verifikasi, dan kurang privat.

Diganti dengan: expo-local-authentication (Face ID + Fingerprint lokal di HP)
Verifikasi terjadi di device — tidak ada foto yang dikirim ke server.

Jika ada referensi enrollFace(), face.service.ts, atau AWS Rekognition
di kode yang dibuat → HAPUS dan ganti dengan useBiometric.ts
```

### 16.5.5 Offline Mode
```
Mobile app WAJIB bisa digunakan meski sinyal lemah/tidak ada.
Menggunakan WatermelonDB untuk local storage:
- Check-in/out disimpan lokal dulu jika offline
- Foto disimpan lokal dengan queue upload
- Sync otomatis ketika koneksi kembali
- Tampilkan badge "Offline" di UI saat tidak ada koneksi
- Conflict resolution: server selalu jadi source of truth
```

### 16.5.6 Database Timezone
```sql
-- Selalu gunakan TIMESTAMP WITH TIME ZONE di PostgreSQL
-- Bukan TIMESTAMP biasa

-- Di TypeORM entity:
@Column({ type: 'timestamptz', default: () => 'NOW()' })
created_at: Date;

-- PostgreSQL config:
SET timezone = 'Asia/Makassar';
-- Atau di connection string: ?timezone=Asia%2FMakassar
```

### 16.5.7 Validasi Nomor HP WhatsApp
```
Format nomor WA untuk kirim pesan:
- Input user: 08123456789 atau +628123456789
- Format yang dibutuhkan whatsapp-web.js: '628123456789@c.us'
- Fungsi normalizer WAJIB ada:
  normalizeWAPhone(phone: string): string {
    phone = phone.replace(/\D/g, '') // hapus non-digit
    if (phone.startsWith('0')) phone = '62' + phone.slice(1)
    if (!phone.startsWith('62')) phone = '62' + phone
    return phone + '@c.us'
  }
```

### 16.5.8 Shift Lintas Tengah Malam
```
Untuk shift malam yang melewati tengah malam (misal 22:00 - 06:00):
- end_time < start_time → shift lintas hari
- Durasi tetap harus 8 jam
- Validasi di database menggunakan:
  CASE WHEN end_time > start_time
    THEN EXTRACT(EPOCH FROM (end_time - start_time))/60
    ELSE EXTRACT(EPOCH FROM (end_time - start_time + INTERVAL '24h'))/60
  END = 480
- Di NestJS validator: tangani kasus ini secara eksplisit
- user_schedules.date = tanggal mulai shift (bukan tanggal selesai)
```

### 16.5.9 Foto Watermark — Format Teks
```
Format WAJIB watermark (urutan ini tidak boleh diubah):
┌─────────────────────────────────────────────┐
│ [LOGO PERUSAHAAN kanan atas, 40x40px max]   │
│                                              │
│         [AREA FOTO]                          │
│                                              │
├─────────────────────────────────────────────┤
│ Waktu   : Kamis, 03 Apr 2025 10:32:14 WITA   │
│ Lat     : -6.175392                          │
│ Lng     : 106.827153                         │
│ Kab     : Kab. Jakarta Selatan               │
│ Prov    : DKI Jakarta                        │
│ Lokasi  : PT. Maju Bersama · Gedung B        │
└─────────────────────────────────────────────┘

Spesifikasi teknis watermark:
- Background watermark: rgba(0,0,0,0.72) — cukup gelap agar terbaca
- Font: monospace, ukuran proporsional dengan resolusi foto
- Warna teks: #FFFFFF
- Tinggi area watermark: ~18% dari tinggi foto
- Padding: 8px dari tepi
- Koordinat: SELALU 6 angka desimal, tidak dibulatkan
- Nama hari dalam Bahasa Indonesia (Senin, Selasa, ... Minggu)
- Nama bulan singkatan 3 huruf Bahasa Indonesia (Jan, Feb, ... Des)
```

### 16.5.10 Berita Acara — Nomor Dokumen
```
Format: BA-YYYY/MM/NNN
Contoh: BA-2025/04/001, BA-2025/04/002, ..., BA-2025/05/001

Aturan:
- YYYY: tahun 4 digit
- MM: bulan 2 digit (01-12)
- NNN: nomor urut 3 digit, reset ke 001 setiap awal bulan
- Thread-safe: gunakan PostgreSQL sequence atau SELECT FOR UPDATE
- Jangan gunakan application-level counter (race condition)

Implementasi SQL:
CREATE SEQUENCE IF NOT EXISTS ba_seq_{YYYY}_{MM} START 1;
-- Atau gunakan SERIAL di tabel khusus:
CREATE TABLE report_sequences (
  year_month VARCHAR(7) PRIMARY KEY, -- '2025-04'
  last_number INTEGER DEFAULT 0
);
-- Dengan SELECT ... FOR UPDATE saat generate nomor baru
```

### 16.5.11 Role & Permission Matrix
```
AKSI                          | Admin | Manager | Senior | Junior
─────────────────────────────────────────────────────────────────
Buat karyawan baru            |  ✓   |    ✗    |   ✗   |   ✗
Edit data karyawan            |  ✓   |    ✗    |   ✗   |   ✗
Konfigurasi shift/jadwal      |  ✓   |    ✗    |   ✗   |   ✗
Konfigurasi aturan cuti       |  ✓   |    ✗    |   ✗   |   ✗
Tambah hari libur nasional    |  ✓   |    ✗    |   ✗   |   ✗
Buat tugas baru               |  ✓   |    ✓   |   ✗   |   ✗
Assign tugas ke teknisi       |  ✓   |    ✓   |   ✗   |   ✗
Broadcast tugas ke tim        |  ✓   |    ✓   |   ✗   |   ✗
Override assign kapanpun      |  ✓   |    ✓   |   ✗   |   ✗
Approve delegasi              |  ✓   |    ✓   |   ✗   |   ✗
Approve swap jadwal           |  ✓   |    ✓   |   ✗   |   ✗
Approve cuti karyawan         |  ✓   |    ✓   |   ✗   |   ✗
Approve keberatan alfa        |  ✓   |    ✓   |   ✗   |   ✗
Lihat semua laporan           |  ✓   |    ✓   |   ✗   |   ✗
-- SCOPE MANAGER (WAJIB diimplementasikan di SEMUA endpoint laporan):
-- Manager HANYA bisa lihat data departemennya sendiri
-- Admin bisa lihat semua departemen tanpa filter
-- Query filter wajib di setiap reports service:
--   if (user.role === 'manager') query.where('dept_id = :deptId', { deptId: user.dept_id })
--   if (user.role === 'admin')   // no dept filter
-- Berlaku untuk: laporan absensi, kunjungan, cuti, lembur, SP, klaim biaya
Lihat peta monitoring live    |  ✓   |    ✓   |   ✗   |   ✗
Terima/tolak tugas            |  ✓   |    ✓   |   ✓   |   ✓
Delegasi ke junior            |  ✓   |    ✓   |   ✓   |   ✗
Ajukan swap jadwal            |  ✓   |    ✓   |   ✓   |   ✓
Ajukan cuti/izin              |  ✓   |    ✓   |   ✓   |   ✓
Ajukan keberatan alfa         |  ✓   |    ✓   |   ✓   |   ✓
Check-in/out absensi          |  ✓   |    ✓   |   ✓   |   ✓
Lihat jadwal sendiri          |  ✓   |    ✓   |   ✓   |   ✓
Buat kunjungan & BA           |  ✓   |    ✓   |   ✓   |   ✓
Scan WA QR code (admin panel) |  ✓   |    ✗   |   ✗   |   ✗
Export laporan                |  ✓   |    ✓   |   ✗   |   ✗
```

### 16.5.12 Index Database yang Wajib Dibuat
```sql
-- Performance kritis, WAJIB dibuat di migration:
CREATE INDEX idx_attendances_user_date ON attendances(user_id, date);
CREATE INDEX idx_attendances_date ON attendances(date);
CREATE INDEX idx_attendances_status ON attendances(status);
CREATE INDEX idx_user_schedules_user_date ON user_schedules(user_id, date);
CREATE INDEX idx_user_schedules_date ON user_schedules(date);
CREATE INDEX idx_visits_user_id ON visits(user_id);
CREATE INDEX idx_visits_status ON visits(status);
CREATE INDEX idx_visits_created_at ON visits(created_at);
CREATE INDEX idx_visit_photos_visit_phase ON visit_photos(visit_id, phase);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX idx_leave_requests_user_status ON leave_requests(user_id, status);
CREATE INDEX idx_leave_balance_logs_user ON leave_balance_logs(user_id);
CREATE INDEX idx_pending_deductions_status ON pending_deductions(status, deadline_at);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_national_holidays_date ON national_holidays(date);
```


---