'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { isAuthenticated, getAuthUser, clearAuthData, type AuthUser } from '@/lib/auth';
import {
  LayoutDashboard,
  MapPin,
  CalendarDays,
  ClipboardCheck,
  ListTodo,
  UmbrellaOff,
  Users,
  Building2,
  BarChart3,
  FileStack,
  Wallet,
  Siren,
  Megaphone,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react';

// ── Nav structure ─────────────────────────────────────────────────────────────
type NavItem = { href: string; label: string; icon: LucideIcon; color: string; bg: string };
type NavGroup = { group: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    group: 'Utama',
    items: [
      { href: '/dashboard',            label: 'Beranda',       icon: LayoutDashboard, color: 'text-[#007AFF]',  bg: 'bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.15)]' },
      { href: '/dashboard/monitoring', label: 'Monitoring',    icon: MapPin,           color: 'text-[#34C759]',  bg: 'bg-[#F0FDF4] dark:bg-[rgba(52,199,89,0.15)]'  },
    ],
  },
  {
    group: 'Operasional',
    items: [
      { href: '/dashboard/schedule',   label: 'Jadwal',     icon: CalendarDays,  color: 'text-[#FF9500]',  bg: 'bg-[#FFF7ED] dark:bg-[rgba(255,149,0,0.15)]'  },
      { href: '/dashboard/attendance', label: 'Absensi',    icon: ClipboardCheck,color: 'text-[#30D158]',  bg: 'bg-[#F0FDF4] dark:bg-[rgba(48,209,88,0.15)]'  },
      { href: '/dashboard/tasks',      label: 'Tugas & Kunjungan', icon: ListTodo, color: 'text-[#AF52DE]', bg: 'bg-[#FAF5FF] dark:bg-[rgba(175,82,222,0.15)]' },
      { href: '/dashboard/keuangan',   label: 'Keuangan',   icon: Wallet,     color: 'text-[#FF9500]',  bg: 'bg-[#FFF7ED] dark:bg-[rgba(255,149,0,0.15)]'  },
      { href: '/dashboard/leave',      label: 'Cuti',       icon: UmbrellaOff, color: 'text-[#32ADE6]',  bg: 'bg-[#EFF9FF] dark:bg-[rgba(50,173,230,0.15)]' },
    ],
  },
  {
    group: 'SDM & Klien',
    items: [
      { href: '/dashboard/employees', label: 'Karyawan',    icon: Users,     color: 'text-[#007AFF]',  bg: 'bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.15)]' },
      { href: '/dashboard/clients',   label: 'Klien & SLA', icon: Building2, color: 'text-[#636366]',  bg: 'bg-[#F2F2F7] dark:bg-[rgba(99,99,102,0.20)]'  },
    ],
  },
  {
    group: 'Lainnya',
    items: [
      { href: '/dashboard/reports',       label: 'Laporan',       icon: BarChart3, color: 'text-[#34C759]',  bg: 'bg-[#F0FDF4] dark:bg-[rgba(52,199,89,0.15)]'  },
      { href: '/dashboard/templates',     label: 'Template BA',   icon: FileStack, color: 'text-[#5856D6]',  bg: 'bg-[#F0EFFE] dark:bg-[rgba(88,86,214,0.15)]'  },
      { href: '/dashboard/sos',           label: 'SOS & Darurat', icon: Siren,     color: 'text-[#FF3B30]',  bg: 'bg-[#FEF2F2] dark:bg-[rgba(255,59,48,0.15)]'  },
      { href: '/dashboard/announcements', label: 'Pengumuman',    icon: Megaphone, color: 'text-[#32ADE6]',  bg: 'bg-[#EFF9FF] dark:bg-[rgba(50,173,230,0.15)]' },
      { href: '/dashboard/settings',      label: 'Pengaturan',    icon: Settings,  color: 'text-[#636366]',  bg: 'bg-[#F2F2F7] dark:bg-[rgba(99,99,102,0.20)]'  },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const ROLE_COLOR: Record<string, string> = {
  super_admin: 'bg-orange-100 text-orange-700',
  admin:       'bg-red-100 text-red-600',
  manager:     'bg-violet-100 text-violet-700',
  karyawan:    'bg-gray-100 text-gray-600',
};

// ── Layout ────────────────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [mounted,    setMounted]    = useState(false);
  const [collapsed,  setCollapsed]  = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user,        setUser]        = useState<AuthUser | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) { router.replace('/login'); return; }
    setUser(getAuthUser());
    // Pulihkan state collapsed dari localStorage
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved !== null) setCollapsed(saved === 'true');
  }, [router]);

  const handleCollapse = (val: boolean) => {
    setCollapsed(val);
    localStorage.setItem('sidebar_collapsed', String(val));
  };

  // Tutup drawer saat navigasi ke halaman lain
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  if (!mounted) return null;

  const handleLogout = () => {
    clearAuthData();
    router.replace('/login');
  };

  // ── Sidebar content (shared antara desktop & mobile drawer) ──────────────────
  const sidebarContent = (isMobile = false) => (
    <>
      {/* Logo + collapse toggle */}
      <div className={`flex items-center border-b border-black/[0.06] dark:border-white/[0.07]
        ${(collapsed && !isMobile) ? 'justify-center px-0 py-4' : 'justify-between px-4 py-4'}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-[10px] bg-[#007AFF] flex items-center justify-center shadow-[0_2px_8px_rgba(0,122,255,0.4)] flex-shrink-0">
            <span className="text-white text-[13px] font-bold">A</span>
          </div>
          {(!collapsed || isMobile) && (
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-gray-900 dark:text-white leading-tight">AttendenX</p>
              <p className="text-[10px] text-gray-400 dark:text-white/35">Admin Dashboard</p>
            </div>
          )}
        </div>
        {/* Desktop collapse btn */}
        {!isMobile && !collapsed && (
          <button onClick={() => handleCollapse(true)}
            className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
            <ChevronLeft size={14} />
          </button>
        )}
        {/* Mobile close btn */}
        {isMobile && (
          <button onClick={() => setMobileOpen(false)}
            className="w-7 h-7 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {(collapsed && !isMobile) && (
          <button onClick={() => handleCollapse(false)}
            className="w-full flex items-center justify-center h-8 mb-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors">
            <ChevronRight size={14} />
          </button>
        )}

        {NAV.map((group) => (
          <div key={group.group} className="mb-1">
            {(!collapsed || isMobile) && (
              <p className="text-[10px] font-semibold uppercase tracking-[0.6px] text-gray-400 dark:text-white/25 px-3 pt-3 pb-1">
                {group.group}
              </p>
            )}
            {(collapsed && !isMobile) && <div className="h-2" />}

            {group.items.map((item) => {
              // Pages merged into other routes — treat as active for their canonical route
              const ALIAS: Record<string, string[]> = {
                '/dashboard/keuangan':   ['/dashboard/expense-claims', '/dashboard/business-trips'],
                '/dashboard/tasks':      ['/dashboard/visits', '/dashboard/service-reports'],
                '/dashboard/attendance': ['/dashboard/violations'],
              };
              const aliases = ALIAS[item.href] ?? [];
              const active = pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href)) ||
                aliases.some((a) => pathname === a || pathname.startsWith(a));
              const Icon = item.icon;
              const isCollapsedDesktop = collapsed && !isMobile;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={isCollapsedDesktop ? item.label : undefined}
                  className={`
                    group relative flex items-center gap-2.5 rounded-[9px] mb-0.5
                    text-[13px] font-medium transition-all duration-150
                    ${isCollapsedDesktop ? 'justify-center px-0 py-2' : 'px-2 py-1.5'}
                    ${active
                      ? 'bg-[#007AFF] text-white shadow-[0_2px_8px_rgba(0,122,255,0.28)]'
                      : 'text-gray-700 dark:text-white/65 hover:bg-gray-100/80 dark:hover:bg-white/[0.06]'
                    }
                  `}
                >
                  <span className={`
                    flex-shrink-0 flex items-center justify-center
                    w-[28px] h-[28px] rounded-[7px] transition-all duration-150
                    ${active ? 'bg-white/20' : `${item.bg} group-hover:scale-105`}
                  `}>
                    <Icon size={15} strokeWidth={active ? 2.2 : 1.9}
                      className={active ? 'text-white' : item.color} />
                  </span>

                  {!isCollapsedDesktop && <span className="truncate">{item.label}</span>}

                  {isCollapsedDesktop && active && (
                    <span className="absolute right-1 top-1 w-1.5 h-1.5 rounded-full bg-white/80" />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User profile */}
      <div className={`border-t border-black/[0.06] dark:border-white/[0.07]
        ${(collapsed && !isMobile) ? 'p-2' : 'p-3'}`}>
        {(!collapsed || isMobile) && user && (
          <div className="flex items-center gap-2.5 mb-2 px-1">
            <div className="w-8 h-8 rounded-full bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.18)] flex items-center justify-center flex-shrink-0 overflow-hidden">
              {user.avatar_url && !avatarError
                ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" onError={() => setAvatarError(true)} />
                : <span className="text-[12px] font-bold text-[#007AFF]">{user.name?.charAt(0) ?? 'U'}</span>
              }
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-gray-900 dark:text-white truncate leading-tight">{user.name}</p>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLOR[user.role?.name] ?? ROLE_COLOR.karyawan}`}>
                {user.role?.name ?? '—'}
              </span>
            </div>
          </div>
        )}
        <button onClick={handleLogout} title="Keluar"
          className={`
            w-full flex items-center gap-2 rounded-[9px] text-[12px] font-medium
            text-gray-500 dark:text-white/40 hover:text-red-600 dark:hover:text-red-400
            hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors
            ${(collapsed && !isMobile) ? 'justify-center py-2.5' : 'px-3 py-2'}
          `}
        >
          <LogOut size={15} strokeWidth={1.8} className="flex-shrink-0" />
          {(!collapsed || isMobile) && <span>Keluar</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-[#F2F2F7] dark:bg-gray-950 overflow-hidden">

      {/* ── Mobile overlay backdrop ──────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Desktop sidebar — hidden on mobile, static on desktop ── */}
      <aside className={`
        hidden lg:flex flex-col flex-shrink-0
        bg-white dark:bg-[#1C1C1E]
        border-r border-black/[0.06] dark:border-white/[0.07]
        transition-[width] duration-300 ease-in-out
        ${collapsed ? 'w-[64px]' : 'w-[220px]'}
      `}>
        {sidebarContent(false)}
      </aside>

      {/* ── Mobile drawer — lg:hidden, slides in from left ──────── */}
      <aside className={`
        flex flex-col lg:hidden
        bg-white dark:bg-[#1C1C1E]
        border-r border-black/[0.06] dark:border-white/[0.07]
        transition-transform duration-300 ease-in-out
        fixed inset-y-0 left-0 z-50 w-[260px]
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {sidebarContent(true)}
      </aside>

      {/* ── Content area (header mobile + main) ─────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Mobile header bar — hanya muncul di < lg */}
        <header className="lg:hidden flex items-center justify-between h-14 px-4
          bg-white dark:bg-[#1C1C1E]
          border-b border-black/[0.06] dark:border-white/[0.07]
          flex-shrink-0 z-30">
          <button
            onClick={() => setMobileOpen(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 dark:text-white/60
              hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <Menu size={20} strokeWidth={1.8} />
          </button>

          {/* Logo center */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[8px] bg-[#007AFF] flex items-center justify-center shadow-[0_2px_6px_rgba(0,122,255,0.4)]">
              <span className="text-white text-[11px] font-bold">A</span>
            </div>
            <span className="text-[14px] font-semibold text-gray-900 dark:text-white">AttendenX</span>
          </div>

          {/* Spacer kanan agar logo tetap center */}
          <div className="w-9" />
        </header>

        {/* Main content — relative + min-h-0 wajib ada:
            - relative  → jadi containing block untuk absolute-positioned children (e.g. monitoring page)
            - min-h-0   → cegah flex-blowout di Firefox/Chrome saat konten panjang
            - overflow-y-auto → halaman biasa bisa scroll via parent ini */}
        <main className="relative flex-1 min-h-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
