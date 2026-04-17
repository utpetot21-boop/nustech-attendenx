/**
 * M-05 — Riwayat Kunjungan Lapangan
 * List semua kunjungan dengan filter status.
 * Manager/admin: tombol + untuk buat tugas kunjungan baru.
 * iOS 26 Liquid Glass design
 */
import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
  Modal,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  MapPin,
  Clock,
  Timer,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Navigation,
  Plus,
  User,
  Search,
  X,
  Briefcase,
  ChevronLeft,
  AlertCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { visitsService, type VisitSummary } from '@/services/visits.service';
import { tasksService } from '@/services/tasks.service';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { C, R, B, T, S, cardBg, pageBg, lPrimary, lSecondary, lTertiary } from '@/constants/tokens';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterChips } from '@/components/ui/FilterChips';
import { VisitCardSkeleton } from '@/components/ui/SkeletonLoader';

// ─────────────────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string }> = {
  ongoing:     { label: 'Berlangsung', color: C.blue   },
  completed:   { label: 'Selesai',     color: C.green  },
  on_hold:     { label: 'Ditahan',     color: C.orange },
  rescheduled: { label: 'Dijadwal Ulang', color: C.purple },
};

const FILTERS = [
  { label: 'Semua',       value: undefined     },
  { label: 'Berlangsung', value: 'ongoing'      },
  { label: 'Selesai',     value: 'completed'    },
  { label: 'Ditahan',     value: 'on_hold'      },
];

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Rendah',   color: C.green  },
  { value: 'normal', label: 'Normal',   color: C.blue   },
  { value: 'high',   label: 'Tinggi',   color: C.orange },
  { value: 'urgent', label: 'Mendesak', color: C.red    },
] as const;

const TASK_TYPE_OPTIONS = [
  { value: 'visit',       label: 'Kunjungan'   },
  { value: 'maintenance', label: 'Maintenance'  },
  { value: 'inspection',  label: 'Inspeksi'    },
  { value: 'other',       label: 'Lainnya'     },
] as const;

type Priority    = 'low' | 'normal' | 'high' | 'urgent';
type TaskType    = 'visit' | 'maintenance' | 'inspection' | 'other';
type PickerMode  = 'employee' | 'client' | 'department' | null;

interface EmployeeItem   { id: string; full_name: string; employee_id?: string }
interface ClientItem     { id: string; name: string; address?: string }
interface DepartmentItem { id: string; name: string }

const fieldLabel = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.6, marginBottom: 8 } as const;

// ─────────────────────────────────────────────────────────────────────────────
// Visit Card
// ─────────────────────────────────────────────────────────────────────────────

function VisitCard({ visit, onPress }: { visit: VisitSummary; onPress: () => void }) {
  const isDark = useColorScheme() === 'dark';
  const meta   = STATUS_META[visit.status] ?? STATUS_META.ongoing;
  const isOngoing = visit.status === 'ongoing';

  const checkInTime = new Date(visit.check_in_at).toLocaleString('id-ID', {
    timeZone: 'Asia/Makassar', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.80}
      style={{
        backgroundColor: cardBg(isDark),
        borderRadius: R.lg,
        borderWidth: B.default,
        borderColor: isOngoing
          ? isDark ? 'rgba(0,122,255,0.35)' : 'rgba(0,122,255,0.22)'
          : isDark ? C.separator.dark : C.separator.light,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 10,
        ...(isDark ? S.cardDark : S.card),
      }}
    >
      {/* Row 1 — client + status badge */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: lPrimary(isDark), letterSpacing: -0.3 }} numberOfLines={1}>
            {visit.client?.name ?? '—'}
          </Text>
          {visit.client?.pic_name && (
            <Text style={{ fontSize: 13, color: lSecondary(isDark), marginTop: 2 }}>
              PIC: {visit.client.pic_name}
            </Text>
          )}
        </View>
        <StatusBadge label={meta.label} color={meta.color} dot={isOngoing} />
      </View>

      {/* Row 2 — time + duration */}
      <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap', marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Clock size={12} strokeWidth={1.8} color={lTertiary(isDark)} />
          <Text style={{ fontSize: 13, color: lSecondary(isDark) }}>{checkInTime} WITA</Text>
        </View>
        {(visit.duration_minutes ?? 0) > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Timer size={12} strokeWidth={1.8} color={lTertiary(isDark)} />
            <Text style={{ fontSize: 13, color: lSecondary(isDark) }}>
              {Math.floor(visit.duration_minutes! / 60)}j {visit.duration_minutes! % 60}m
            </Text>
          </View>
        )}
      </View>

      {/* Row 3 — GPS + chevron */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          {visit.gps_valid
            ? <CheckCircle2 size={12} strokeWidth={2} color={C.green} />
            : <AlertTriangle size={12} strokeWidth={2} color={C.orange} />
          }
          <Text style={{ fontSize: 12, color: lTertiary(isDark) }}>
            {visit.gps_valid ? 'GPS valid' : `Deviasi ${visit.gps_deviation_meter}m`}
          </Text>
        </View>
        <ChevronRight size={14} strokeWidth={2} color={lTertiary(isDark)} />
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Task Sheet — form lengkap (judul, tipe, dispatch, jadwal, darurat)
// ─────────────────────────────────────────────────────────────────────────────

function CreateTaskSheet({
  visible, onClose, onSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isDark  = useColorScheme() === 'dark';
  const insets  = useSafeAreaInsets();

  const [pickerMode, setPickerMode]     = useState<PickerMode>(null);
  const [search, setSearch]             = useState('');
  const [title, setTitle]               = useState('');
  const [taskType, setTaskType]         = useState<TaskType>('visit');
  const [priority, setPriority]         = useState<Priority>('normal');
  const [client, setClient]             = useState<ClientItem | null>(null);
  const [dispatchType, setDispatchType] = useState<'direct' | 'broadcast'>('direct');
  const [employee, setEmployee]         = useState<EmployeeItem | null>(null);
  const [department, setDepartment]     = useState<DepartmentItem | null>(null);
  const [scheduledAt, setScheduledAt]   = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isEmergency, setIsEmergency]   = useState(false);
  const [notes, setNotes]               = useState('');

  const bg      = isDark ? '#1C1C1E' : '#F2F2F7';
  const cardCol = isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF';
  const border  = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
  const prim    = lPrimary(isDark);
  const sec     = lSecondary(isDark);
  const ter     = lTertiary(isDark);

  const { data: employees = [], isFetching: loadingEmp } = useQuery({
    queryKey: ['colleagues-picker', search],
    queryFn: () => api.get('/users/colleagues', { params: { search } }).then((r) => r.data.items as EmployeeItem[]),
    enabled: visible && pickerMode === 'employee',
    staleTime: 30_000,
  });

  const { data: clients = [], isFetching: loadingCli } = useQuery({
    queryKey: ['clients-picker', search],
    queryFn: () => api.get('/clients', { params: { search } }).then((r) => r.data as ClientItem[]),
    enabled: visible && pickerMode === 'client',
    staleTime: 30_000,
  });

  const { data: departments = [], isFetching: loadingDept } = useQuery({
    queryKey: ['departments-picker'],
    queryFn: () => api.get('/departments').then((r) => r.data as DepartmentItem[]),
    enabled: visible && pickerMode === 'department',
    staleTime: 5 * 60_000,
  });

  const canSubmit = title.trim() &&
    (dispatchType === 'direct' ? !!employee : !!department);

  const createMut = useMutation({
    mutationFn: () => tasksService.createTask({
      title: title.trim(),
      type: taskType,
      priority,
      client_id: client?.id,
      dispatch_type: dispatchType,
      assigned_to: dispatchType === 'direct' ? employee?.id : undefined,
      broadcast_dept_id: dispatchType === 'broadcast' ? department?.id : undefined,
      scheduled_at: scheduledAt ? scheduledAt.toISOString() : undefined,
      is_emergency: isEmergency || undefined,
      notes: notes.trim() || undefined,
    }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetForm();
      onSuccess();
      Alert.alert('Berhasil', 'Tugas berhasil dibuat dan dikirim.');
    },
    onError: (err: any) => {
      Alert.alert('Gagal', err?.response?.data?.message ?? 'Terjadi kesalahan.');
    },
  });

  const resetForm = () => {
    setPickerMode(null); setSearch(''); setTitle(''); setTaskType('visit');
    setPriority('normal'); setClient(null); setDispatchType('direct');
    setEmployee(null); setDepartment(null); setScheduledAt(null);
    setShowDatePicker(false); setIsEmergency(false); setNotes('');
  };

  const handleClose = () => { resetForm(); onClose(); };
  const openPicker = (mode: PickerMode) => { setSearch(''); setPickerMode(mode); };

  const formatDate = (d: Date) =>
    d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // ── Picker ─────────────────────────────────────────────────────────────────
  const renderPicker = () => {
    const isEmp  = pickerMode === 'employee';
    const isDept = pickerMode === 'department';
    const items  = isEmp ? employees : isDept ? departments : clients;
    const loading = isEmp ? loadingEmp : isDept ? loadingDept : loadingCli;
    const label  = isEmp ? 'Pilih Teknisi' : isDept ? 'Pilih Departemen' : 'Pilih Klien';

    return (
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: border }}>
          <TouchableOpacity onPress={() => { setPickerMode(null); setSearch(''); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <ChevronLeft size={22} strokeWidth={2} color={C.blue} />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '700', color: prim, flex: 1 }}>{label}</Text>
        </View>
        {!isDept && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, marginBottom: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E8EDF5', borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 10 }}>
            <Search size={15} strokeWidth={2} color={ter} />
            <TextInput value={search} onChangeText={setSearch} placeholder={isEmp ? 'Cari nama karyawan...' : 'Cari klien...'} placeholderTextColor={ter} style={{ flex: 1, fontSize: 15, color: prim }} autoFocus />
            {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')}><X size={15} strokeWidth={2} color={ter} /></TouchableOpacity>}
          </View>
        )}
        {loading ? <ActivityIndicator color={C.blue} style={{ marginTop: 32 }} /> : (
          <FlatList
            data={items as any[]}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: isDept ? 12 : 0, paddingBottom: 24 }}
            ListEmptyComponent={<Text style={{ textAlign: 'center', color: ter, marginTop: 32, fontSize: 14 }}>{search ? 'Tidak ada hasil' : 'Belum ada data'}</Text>}
            renderItem={({ item }) => {
              const name = isEmp ? item.full_name : item.name;
              const sub  = isEmp ? item.employee_id : item.address;
              return (
                <TouchableOpacity
                  onPress={() => {
                    if (isEmp) setEmployee(item);
                    else if (isDept) setDepartment(item);
                    else setClient(item);
                    setPickerMode(null); setSearch('');
                  }}
                  activeOpacity={0.75}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: cardCol, borderRadius: R.md, borderWidth: B.default, borderColor: border, marginBottom: 8 }}
                >
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isDark ? 'rgba(0,122,255,0.18)' : '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
                    {isEmp ? <User size={18} strokeWidth={1.8} color={C.blue} /> : <Briefcase size={18} strokeWidth={1.8} color={C.blue} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: prim }} numberOfLines={1}>{name}</Text>
                    {sub && <Text style={{ fontSize: 12, color: ter, marginTop: 2 }} numberOfLines={1}>{sub}</Text>}
                  </View>
                  <ChevronRight size={14} strokeWidth={2} color={ter} />
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    );
  };

  // ── Form ───────────────────────────────────────────────────────────────────
  const renderForm = () => (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>

      {/* Judul */}
      <Text style={[fieldLabel, { color: ter }]}>JUDUL *</Text>
      <TextInput
        value={title} onChangeText={setTitle}
        placeholder="Nama tugas..."
        placeholderTextColor={ter}
        style={{ backgroundColor: cardCol, borderRadius: R.md, borderWidth: B.default, borderColor: title ? C.blue + '60' : border, padding: 14, fontSize: 15, color: prim, marginBottom: 16 }}
      />

      {/* Tipe + Prioritas */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={[fieldLabel, { color: ter }]}>TIPE</Text>
          <View style={{ gap: 6 }}>
            {TASK_TYPE_OPTIONS.map((opt) => {
              const active = taskType === opt.value;
              return (
                <TouchableOpacity key={opt.value} onPress={() => setTaskType(opt.value)} activeOpacity={0.78}
                  style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: R.sm, backgroundColor: active ? C.blue + '18' : cardCol, borderWidth: active ? 1 : B.default, borderColor: active ? C.blue : border }}>
                  <Text style={{ fontSize: 13, fontWeight: active ? '700' : '500', color: active ? C.blue : sec }}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[fieldLabel, { color: ter }]}>PRIORITAS</Text>
          <View style={{ gap: 6 }}>
            {PRIORITY_OPTIONS.map((opt) => {
              const active = priority === opt.value;
              return (
                <TouchableOpacity key={opt.value} onPress={() => setPriority(opt.value as Priority)} activeOpacity={0.78}
                  style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: R.sm, backgroundColor: active ? opt.color + '18' : cardCol, borderWidth: active ? 1 : B.default, borderColor: active ? opt.color : border }}>
                  <Text style={{ fontSize: 13, fontWeight: active ? '700' : '500', color: active ? opt.color : sec }}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* Klien */}
      <Text style={[fieldLabel, { color: ter }]}>KLIEN</Text>
      <TouchableOpacity onPress={() => openPicker('client')} activeOpacity={0.78}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: cardCol, borderRadius: R.md, borderWidth: B.default, borderColor: client ? C.blue + '60' : border, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 16 }}>
        <Briefcase size={17} strokeWidth={1.8} color={client ? C.blue : ter} />
        <Text style={{ flex: 1, fontSize: 15, color: client ? prim : ter, fontWeight: client ? '600' : '400' }}>
          {client?.name ?? '— Pilih klien —'}
        </Text>
        {client
          ? <TouchableOpacity onPress={() => setClient(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><X size={15} strokeWidth={2} color={ter} /></TouchableOpacity>
          : <ChevronRight size={15} strokeWidth={2} color={ter} />
        }
      </TouchableOpacity>

      {/* Dispatch */}
      <Text style={[fieldLabel, { color: ter }]}>DISPATCH</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {([
          { key: 'direct',    label: 'Direct',    desc: 'Ke 1 teknisi' },
          { key: 'broadcast', label: 'Broadcast', desc: 'Ke departemen' },
        ] as const).map((opt) => {
          const active = dispatchType === opt.key;
          return (
            <TouchableOpacity key={opt.key} onPress={() => { setDispatchType(opt.key); setEmployee(null); setDepartment(null); }} activeOpacity={0.78}
              style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 14, borderRadius: R.md, backgroundColor: active ? C.blue + '14' : cardCol, borderWidth: active ? 1.5 : B.default, borderColor: active ? C.blue : border, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: active ? C.blue : sec }}>{opt.label}</Text>
              <Text style={{ fontSize: 11, color: active ? C.blue + 'AA' : ter, marginTop: 2 }}>{opt.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Teknisi / Departemen */}
      {dispatchType === 'direct' ? (
        <>
          <Text style={[fieldLabel, { color: ter }]}>TEKNISI *</Text>
          <TouchableOpacity onPress={() => openPicker('employee')} activeOpacity={0.78}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: cardCol, borderRadius: R.md, borderWidth: B.default, borderColor: employee ? C.blue + '60' : border, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 16 }}>
            <User size={17} strokeWidth={1.8} color={employee ? C.blue : ter} />
            <Text style={{ flex: 1, fontSize: 15, color: employee ? prim : ter, fontWeight: employee ? '600' : '400' }}>
              {employee?.full_name ?? '— Pilih teknisi —'}
            </Text>
            {employee
              ? <TouchableOpacity onPress={() => setEmployee(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><X size={15} strokeWidth={2} color={ter} /></TouchableOpacity>
              : <ChevronRight size={15} strokeWidth={2} color={ter} />
            }
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={[fieldLabel, { color: ter }]}>DEPARTEMEN *</Text>
          <TouchableOpacity onPress={() => openPicker('department')} activeOpacity={0.78}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: cardCol, borderRadius: R.md, borderWidth: B.default, borderColor: department ? C.blue + '60' : border, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 16 }}>
            <Briefcase size={17} strokeWidth={1.8} color={department ? C.blue : ter} />
            <Text style={{ flex: 1, fontSize: 15, color: department ? prim : ter, fontWeight: department ? '600' : '400' }}>
              {department?.name ?? '— Pilih departemen —'}
            </Text>
            {department
              ? <TouchableOpacity onPress={() => setDepartment(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><X size={15} strokeWidth={2} color={ter} /></TouchableOpacity>
              : <ChevronRight size={15} strokeWidth={2} color={ter} />
            }
          </TouchableOpacity>
        </>
      )}

      {/* Jadwal */}
      <Text style={[fieldLabel, { color: ter }]}>JADWAL</Text>
      <TouchableOpacity onPress={() => setShowDatePicker(true)} activeOpacity={0.78}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: cardCol, borderRadius: R.md, borderWidth: B.default, borderColor: scheduledAt ? C.blue + '60' : border, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 16 }}>
        <Clock size={17} strokeWidth={1.8} color={scheduledAt ? C.blue : ter} />
        <Text style={{ flex: 1, fontSize: 15, color: scheduledAt ? prim : ter, fontWeight: scheduledAt ? '600' : '400' }}>
          {scheduledAt ? formatDate(scheduledAt) : 'Pilih tanggal & waktu...'}
        </Text>
        {scheduledAt
          ? <TouchableOpacity onPress={() => setScheduledAt(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><X size={15} strokeWidth={2} color={ter} /></TouchableOpacity>
          : <ChevronRight size={15} strokeWidth={2} color={ter} />
        }
      </TouchableOpacity>

      {showDatePicker && (
        <DateTimePicker
          value={scheduledAt ?? new Date()}
          mode="datetime"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_, date) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (date) setScheduledAt(date);
          }}
          style={{ marginBottom: 12 }}
        />
      )}

      {/* Darurat */}
      <TouchableOpacity onPress={() => setIsEmergency((v) => !v)} activeOpacity={0.78}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: isEmergency ? C.red + '10' : cardCol, borderRadius: R.md, borderWidth: isEmergency ? 1 : B.default, borderColor: isEmergency ? C.red + '50' : border, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 20 }}>
        <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: isEmergency ? C.red : ter, backgroundColor: isEmergency ? C.red : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {isEmergency && <CheckCircle2 size={13} strokeWidth={3} color="#FFF" />}
        </View>
        <AlertCircle size={17} strokeWidth={1.8} color={isEmergency ? C.red : ter} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: isEmergency ? C.red : sec }}>Tandai sebagai Darurat</Text>
      </TouchableOpacity>

      {/* Catatan */}
      <Text style={[fieldLabel, { color: ter }]}>CATATAN</Text>
      <TextInput value={notes} onChangeText={setNotes} placeholder="Instruksi atau catatan tambahan..." placeholderTextColor={ter} multiline numberOfLines={3} textAlignVertical="top"
        style={{ backgroundColor: cardCol, borderRadius: R.md, borderWidth: B.default, borderColor: border, padding: 14, fontSize: 15, color: prim, minHeight: 80, marginBottom: 24 }} />

      {/* Submit */}
      <TouchableOpacity
        onPress={() => createMut.mutate()}
        disabled={!canSubmit || createMut.isPending}
        activeOpacity={0.85}
        style={{ paddingVertical: 16, borderRadius: R.md, backgroundColor: canSubmit ? C.blue : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'), alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
      >
        {createMut.isPending
          ? <ActivityIndicator color="#FFF" size="small" />
          : <Briefcase size={18} strokeWidth={2} color={canSubmit ? '#FFF' : ter} />
        }
        <Text style={{ fontSize: 16, fontWeight: '700', color: canSubmit ? '#FFF' : ter }}>
          {createMut.isPending ? 'Membuat Tugas…' : 'Buat & Kirim Tugas'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: bg }}>
        <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)' }} />
        </View>
        {!pickerMode && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.blue + '20', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={18} strokeWidth={2} color={C.blue} />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: prim }}>Buat Tugas Baru</Text>
            </View>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} strokeWidth={2.2} color={prim} />
            </TouchableOpacity>
          </View>
        )}
        {pickerMode ? renderPicker() : renderForm()}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function VisitsListScreen() {
  const isDark  = useColorScheme() === 'dark';
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const qc      = useQueryClient();

  const user      = useAuthStore((s) => s.user);
  const isManager = ['manager', 'admin', 'super_admin'].includes(user?.role?.name ?? '');

  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [showCreate, setShowCreate]     = useState(false);

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['visits', statusFilter],
    queryFn:  () => visitsService.getMyVisits({ status: statusFilter }),
  });

  const handleRefresh = useCallback(() => { refetch(); }, [refetch]);

  const ongoingVisit = data?.items.find((v) => v.status === 'ongoing');

  return (
    <View style={{ flex: 1, backgroundColor: pageBg(isDark) }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor={C.blue} />
        }
      >
        {/* Header */}
        <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ ...T.title1, color: lPrimary(isDark) }}>
                Kunjungan
              </Text>
              <Text style={{ ...T.footnote, color: lSecondary(isDark), marginTop: 3 }}>
                {data?.total ?? 0} kunjungan tercatat
              </Text>
            </View>

            {/* Tombol + untuk manager */}
            {isManager ? (
              <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowCreate(true); }}
                activeOpacity={0.80}
                style={{
                  width: 48, height: 48, borderRadius: R.md,
                  backgroundColor: C.blue,
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: C.blue,
                  shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
                }}
              >
                <Plus size={24} strokeWidth={2.5} color="#FFF" />
              </TouchableOpacity>
            ) : (
              <View style={{
                width: 48, height: 48, borderRadius: R.md,
                backgroundColor: isDark ? 'rgba(0,122,255,0.15)' : '#EFF6FF',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <MapPin size={24} strokeWidth={1.8} color={C.blue} />
              </View>
            )}
          </View>
        </View>

        {/* Filter chips */}
        <FilterChips
          options={FILTERS}
          value={statusFilter}
          onChange={setStatusFilter}
          isDark={isDark}
        />

        {/* Ongoing banner */}
        {ongoingVisit && (
          <TouchableOpacity
            onPress={() => router.push(`/(main)/visits/${ongoingVisit.id}` as never)}
            activeOpacity={0.88}
            style={{
              marginHorizontal: 16, marginBottom: 12,
              backgroundColor: C.blue,
              borderRadius: R.lg, padding: 16,
              flexDirection: 'row', alignItems: 'center', gap: 12,
              shadowColor: C.blue,
              shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.32, shadowRadius: 14, elevation: 8,
            }}
          >
            <View style={{ width: 44, height: 44, borderRadius: R.sm, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
              <Navigation size={22} strokeWidth={2} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>Kunjungan Berlangsung</Text>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 }}>
                {ongoingVisit.client?.name} · Ketuk untuk lanjutkan
              </Text>
            </View>
            <ChevronRight size={18} strokeWidth={2.5} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        )}

        {/* List */}
        {isLoading ? (
          <View style={{ paddingTop: 8 }}>
            {[0, 1, 2, 3].map((i) => <VisitCardSkeleton key={i} isDark={isDark} />)}
          </View>
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState
            icon={MapPin}
            iconColor={C.blue}
            title="Belum ada kunjungan"
            message={
              isManager
                ? 'Ketuk tombol + untuk membuat tugas kunjungan baru.'
                : 'Kunjungan lapangan akan muncul di sini setelah check-in dimulai dari halaman Pekerjaan.'
            }
          />
        ) : (
          data?.items.map((visit) => (
            <VisitCard
              key={visit.id}
              visit={visit}
              onPress={() => router.push(`/(main)/visits/${visit.id}` as never)}
            />
          ))
        )}

        <View style={{ height: insets.bottom + 96 }} />
      </ScrollView>

      {/* Create task sheet (manager only) */}
      {isManager && (
        <CreateTaskSheet
          visible={showCreate}
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ['tasks-all'] });
          }}
        />
      )}
    </View>
  );
}
