/**
 * M-10 — Notifikasi & Pengumuman
 * iOS 26 Liquid Glass design — dengan tab Notifikasi / Pengumuman
 */
import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, useColorScheme,
  RefreshControl, StatusBar, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, R, B, T, pageBg, lPrimary, lSecondary } from '@/constants/tokens';
import { EmptyState } from '@/components/ui/EmptyState';
import { NotifCardSkeleton } from '@/components/ui/SkeletonLoader';
import {
  Bell,
  BellOff,
  Megaphone,
  Info,
  AlertCircle,
  AlertTriangle,
  Sun,
  FileText,
  Pin,
  CheckCircle2,
  XCircle,
  ClipboardList,
  Ban,
  Hand,
  Repeat2,
} from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  type: 'info' | 'urgent' | 'holiday' | 'policy';
  is_pinned: boolean;
  sent_at: string | null;
  is_read: boolean;
}

const ANN_COLOR: Record<string, string> = {
  info: C.blue, urgent: C.red, holiday: C.green, policy: C.purple,
};

// M4: ANN_ICON_MAP tidak bergantung pada isDark — cukup didefinisi sekali di luar komponen
type LucideIconComponent = React.ComponentType<{ size: number; strokeWidth: number; color: string }>;
const ANN_ICON_MAP: Record<string, LucideIconComponent> = {
  info: Info, urgent: AlertCircle, holiday: Sun, policy: FileText,
};

type Tab = 'notif' | 'ann';

export default function NotificationsScreen() {
  const isDark = useColorScheme() === 'dark';
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('notif');

  // Notifications
  const { data: notifData, isLoading: notifLoading, isRefetching: notifRefetching, refetch: refetchNotif } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then((r) => r.data as { items: Notif[]; total: number }),
    refetchInterval: 30000,
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMut = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Announcements
  // L7: enabled hanya saat tab aktif — loading state muncul saat pertama kali buka tab,
  //     dan tidak fetch sia-sia saat user sedang di tab Notifikasi
  const { data: announcements = [], isLoading: annLoading, isRefetching: annRefetching, refetch: refetchAnn } = useQuery<Announcement[]>({
    queryKey: ['my-announcements'],
    queryFn: () => api.get('/announcements/me').then((r) => r.data),
    refetchInterval: 60000,
    enabled: activeTab === 'ann',
  });

  const markAnnReadMut = useMutation({
    mutationFn: (id: string) => api.post(`/announcements/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-announcements'] }),
  });

  const handleRefresh = useCallback(() => {
    if (activeTab === 'notif') refetchNotif();
    else refetchAnn();
  }, [activeTab, refetchNotif, refetchAnn]);

  const isRefreshing = activeTab === 'notif' ? notifRefetching : annRefetching;
  const unread = (notifData?.items ?? []).filter((n) => !n.is_read).length;
  const unreadAnn = announcements.filter((a) => !a.is_read).length;

  const cardBg = (isRead: boolean) => isDark
    ? isRead ? 'rgba(255,255,255,0.06)' : 'rgba(0,122,255,0.15)'
    : isRead ? 'rgba(255,255,255,0.85)' : 'rgba(0,122,255,0.06)';

  const cardBorder = (isRead: boolean) => isDark
    ? isRead ? 'rgba(255,255,255,0.10)' : 'rgba(0,122,255,0.35)'
    : isRead ? 'rgba(0,0,0,0.07)' : 'rgba(0,122,255,0.2)';

  const bg = pageBg(isDark);
  const textPrimary = lPrimary(isDark);
  const textSecondary = lSecondary(isDark);

  // M4: NOTIF_ICON_MAP bergantung pada isDark — useMemo agar tidak dibuat ulang setiap render
  const NOTIF_ICON_MAP = useMemo((): Record<string, { Icon: LucideIconComponent; color: string; bg: string }> => ({
    task_assigned:      { Icon: ClipboardList,  color: '#007AFF', bg: isDark ? 'rgba(0,122,255,0.18)'    : '#EFF6FF' },
    task_accepted:      { Icon: CheckCircle2,   color: '#34C759', bg: isDark ? 'rgba(52,199,89,0.18)'   : '#DCFCE7' },
    task_rejected:      { Icon: XCircle,        color: '#FF3B30', bg: isDark ? 'rgba(255,59,48,0.18)'   : '#FEF2F2' },
    alfa_detected:      { Icon: AlertTriangle,  color: '#FF9500', bg: isDark ? 'rgba(255,149,0,0.18)'   : '#FFFBEB' },
    leave_approved:     { Icon: Sun,            color: '#34C759', bg: isDark ? 'rgba(52,199,89,0.18)'   : '#DCFCE7' },
    leave_rejected:     { Icon: Ban,            color: '#FF3B30', bg: isDark ? 'rgba(255,59,48,0.18)'   : '#FEF2F2' },
    objection_pending:  { Icon: Hand,           color: '#AF52DE', bg: isDark ? 'rgba(175,82,222,0.18)'  : '#F5F3FF' },
    delegation_request: { Icon: Repeat2,        color: '#FF9500', bg: isDark ? 'rgba(255,149,0,0.18)'   : '#FFF7ED' },
    ba_generated:       { Icon: FileText,       color: '#007AFF', bg: isDark ? 'rgba(0,122,255,0.18)'   : '#ECFEFF' },
    sos:                { Icon: AlertCircle,    color: '#FF3B30', bg: isDark ? 'rgba(255,59,48,0.18)'   : '#FEF2F2' },
    default:            { Icon: Bell,           color: '#007AFF', bg: isDark ? 'rgba(0,122,255,0.18)'   : '#EFF6FF' },
  }), [isDark]);

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh}
            tintColor={isDark ? '#FFF' : '#007AFF'} />
        }
      >
        {/* Header */}
        <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <View>
              <Text style={{ ...T.title1, color: textPrimary }}>
                {activeTab === 'notif' ? 'Notifikasi' : 'Pengumuman'}
              </Text>
              {activeTab === 'notif' && unread > 0 && (
                <Text style={{ fontSize: 14, color: '#007AFF', marginTop: 3, fontWeight: '600' }}>{unread} belum dibaca</Text>
              )}
              {activeTab === 'ann' && unreadAnn > 0 && (
                <Text style={{ fontSize: 14, color: '#007AFF', marginTop: 3, fontWeight: '600' }}>{unreadAnn} belum dibaca</Text>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {activeTab === 'notif' && unread > 0 && (
                <TouchableOpacity onPress={() => markAllMut.mutate()} disabled={markAllMut.isPending}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: R.sm, backgroundColor: isDark ? 'rgba(0,122,255,0.2)' : '#EFF6FF' }}>
                  <Text style={{ fontSize: 13, color: '#007AFF', fontWeight: '600' }}>Baca semua</Text>
                </TouchableOpacity>
              )}
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: isDark ? 'rgba(0,122,255,0.18)' : '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
                <Bell size={22} strokeWidth={1.8} color="#007AFF" />
              </View>
            </View>
          </View>

          {/* Tab Switcher */}
          <View style={{
            flexDirection: 'row',
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E8EDF5',
            borderRadius: 16,
            padding: 4,
            marginBottom: 8,
          }}>
            {([
              { key: 'notif' as Tab, label: 'Notifikasi', badge: unread, Icon: Bell },
              { key: 'ann' as Tab,   label: 'Pengumuman', badge: unreadAnn, Icon: Megaphone },
            ] as const).map((tab) => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
                  flexDirection: 'row', justifyContent: 'center', gap: 6,
                  backgroundColor: activeTab === tab.key
                    ? isDark ? '#1E293B' : '#FFFFFF'
                    : 'transparent',
                  shadowColor: activeTab === tab.key ? '#000' : 'transparent',
                  shadowOpacity: activeTab === tab.key ? 0.1 : 0,
                  shadowRadius: 6, elevation: activeTab === tab.key ? 3 : 0,
                }}
              >
                <tab.Icon size={15} strokeWidth={1.8} color={activeTab === tab.key ? '#007AFF' : (isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF')} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: activeTab === tab.key ? (isDark ? '#FFF' : '#0F172A') : (isDark ? 'rgba(255,255,255,0.5)' : '#6B7280') }}>
                  {tab.label}
                </Text>
                {tab.badge > 0 && (
                  <View style={{ backgroundColor: C.red, borderRadius: R.xs, paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: 'center' }}>
                    <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>{tab.badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notifications tab */}
        {activeTab === 'notif' && (
          notifLoading ? (
            <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 10 }}>
              {[0, 1, 2, 3, 4].map((i) => <NotifCardSkeleton key={i} isDark={isDark} />)}
            </View>
          ) : (notifData?.items ?? []).length === 0 ? (
            <EmptyState icon={BellOff} iconColor={C.blue} title="Tidak ada notifikasi" />
          ) : (
            <View style={{ paddingHorizontal: 20, gap: 10 }}>
              {(notifData?.items ?? []).map((notif) => {
                const iconMeta = NOTIF_ICON_MAP[notif.type] ?? NOTIF_ICON_MAP.default;
                return (
                  <TouchableOpacity
                    key={notif.id}
                    onPress={() => { if (!notif.is_read) markReadMut.mutate(notif.id); }}
                    activeOpacity={0.78}
                    style={{
                      backgroundColor: notif.is_read
                        ? isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF'
                        : isDark ? 'rgba(0,122,255,0.12)' : '#EFF6FF',
                      borderRadius: R.lg,
                      borderWidth: B.default,
                      borderColor: notif.is_read
                        ? isDark ? 'rgba(255,255,255,0.10)' : 'rgba(60,60,67,0.10)'
                        : isDark ? 'rgba(0,122,255,0.35)' : '#BFDBFE',
                      padding: 16,
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 14,
                    }}
                  >
                    <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: iconMeta.bg, alignItems: 'center', justifyContent: 'center' }}>
                      <iconMeta.Icon size={22} strokeWidth={1.8} color={iconMeta.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 15, fontWeight: notif.is_read ? '500' : '700', color: isDark ? '#FFF' : '#0F172A', flex: 1, marginRight: 8 }} numberOfLines={1}>
                          {notif.title}
                        </Text>
                        {!notif.is_read && (
                          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#007AFF', marginTop: 3 }} />
                        )}
                      </View>
                      <Text style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B', marginTop: 3, lineHeight: 20 }} numberOfLines={2}>
                        {notif.body}
                      </Text>
                      <Text style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.35)' : '#94A3B8', marginTop: 5 }}>
                        {new Date(notif.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Makassar', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} WITA
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )
        )}

        {/* Announcements tab */}
        {activeTab === 'ann' && (
          annLoading ? (
            <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 10 }}>
              {[0, 1, 2, 3].map((i) => <NotifCardSkeleton key={i} isDark={isDark} />)}
            </View>
          ) : announcements.length === 0 ? (
            <EmptyState icon={Megaphone} iconColor={C.blue} title="Tidak ada pengumuman" />
          ) : (
            <View style={{ paddingHorizontal: 20, gap: 10 }}>
              {announcements.map((ann) => {
                const accentColor = ANN_COLOR[ann.type] ?? C.blue;
                const AnnIcon = ANN_ICON_MAP[ann.type] ?? Info;
                return (
                  <TouchableOpacity
                    key={ann.id}
                    onPress={() => { if (!ann.is_read) markAnnReadMut.mutate(ann.id); }}
                    activeOpacity={0.78}
                    style={{
                      backgroundColor: isDark ? (ann.is_read ? 'rgba(255,255,255,0.06)' : `${accentColor}18`) : (ann.is_read ? '#FFFFFF' : `${accentColor}0D`),
                      borderRadius: R.lg,
                      borderWidth: B.default,
                      borderColor: isDark ? `${accentColor}35` : `${accentColor}28`,
                      borderLeftWidth: 4,
                      borderLeftColor: accentColor,
                      padding: 16,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${accentColor}20`, alignItems: 'center', justifyContent: 'center' }}>
                          <AnnIcon size={18} strokeWidth={1.8} color={accentColor} />
                        </View>
                        <View style={{ flex: 1 }}>
                          {ann.is_pinned && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                              <Pin size={11} strokeWidth={2} color="#FF9500" />
                              <Text style={{ color: '#FF9500', fontSize: 10, fontWeight: '700' }}>DISEMATKAN</Text>
                            </View>
                          )}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ backgroundColor: `${accentColor}20`, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                              <Text style={{ color: accentColor, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>
                                {ann.type}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                      {!ann.is_read && (
                        <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: accentColor, marginTop: 2 }} />
                      )}
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: ann.is_read ? '600' : '700', color: isDark ? '#FFF' : '#0F172A', marginBottom: 6 }}>
                      {ann.title}
                    </Text>
                    <Text style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B', lineHeight: 20 }} numberOfLines={3}>
                      {ann.body}
                    </Text>
                    {ann.sent_at && (
                      <Text style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.35)' : '#94A3B8', marginTop: 8 }}>
                        {new Date(ann.sent_at).toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', day: '2-digit', month: 'long', year: 'numeric' })}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )
        )}

        <View style={{ height: insets.bottom + 96 }} />
      </ScrollView>
    </View>
  );
}
