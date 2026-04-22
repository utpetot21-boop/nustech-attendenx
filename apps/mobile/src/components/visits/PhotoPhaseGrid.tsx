import { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  Modal,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import type { PhotoCounts, PhotoRequirementCount } from '@/services/visits.service';

interface Photo {
  id: string;
  watermarked_url: string;
  thumbnail_url?: string;
  caption?: string;
  taken_at: string;
  photo_requirement_id?: string | null;
}

interface PhaseSection {
  phase: 'before' | 'during' | 'after';
  photos: Photo[];
  counts: PhotoCounts['before'];
}

interface Props {
  sections: PhaseSection[];
  photoCounts?: PhotoCounts;
  onAddPhoto: (phase: 'before' | 'during' | 'after', requirementId?: string) => void;
  isUploading?: boolean;
  uploadingRequirementId?: string | null;
  uploadingPhase?: string | null;
  isCompleted?: boolean;
}

const PHASE_LABELS: Record<string, string> = {
  before: 'Sebelum Pekerjaan',
  during: 'Selama Pekerjaan',
  after: 'Setelah Pekerjaan',
};

const PHASE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  before: { bg: '#FFF7ED', border: '#FED7AA', text: '#C2410C' },
  during: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' },
  after: { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D' },
};

const PHASE_COLORS_DARK: Record<string, { bg: string; border: string; text: string }> = {
  before: { bg: 'rgba(255,159,10,0.14)', border: 'rgba(255,159,10,0.35)', text: '#FCD34D' },
  during: { bg: 'rgba(0,122,255,0.14)', border: 'rgba(0,122,255,0.35)', text: '#93C5FD' },
  after: { bg: 'rgba(52,199,89,0.14)', border: 'rgba(52,199,89,0.35)', text: '#86EFAC' },
};

function RequirementGroup({
  req,
  photos,
  onAdd,
  isUploading,
  isCompleted,
  isDark,
}: {
  req: PhotoRequirementCount;
  photos: Photo[];
  onAdd: () => void;
  isUploading: boolean;
  isCompleted: boolean;
  isDark: boolean;
}) {
  const colorSet = isDark ? PHASE_COLORS_DARK[req.phase] : PHASE_COLORS[req.phase];
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const canAdd = !isCompleted && photos.length < req.max_photos;

  return (
    <View
      style={{
        backgroundColor: colorSet.bg,
        borderRadius: 16,
        borderWidth: 0.5,
        borderColor: colorSet.border,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colorSet.text, flexShrink: 1 }}>
            {req.label}{req.is_required ? ' *' : ''}
          </Text>
          <View style={{ backgroundColor: colorSet.border, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colorSet.text }}>
              {photos.length}/{req.max_photos}
            </Text>
          </View>
        </View>
        {req.is_required && (
          <Text style={{ fontSize: 11, color: photos.length > 0 ? '#34C759' : colorSet.text, fontWeight: '500' }}>
            {photos.length > 0 ? '✓ Terisi' : 'Wajib'}
          </Text>
        )}
      </View>

      {/* Photos */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}
      >
        {photos.map((photo, idx) => (
          <TouchableOpacity key={photo.id} onPress={() => setPreviewUri(photo.watermarked_url)} style={styles.photoThumb}>
            <Image source={{ uri: photo.thumbnail_url ?? photo.watermarked_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <View style={styles.seqBadge}>
              <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>#{idx + 1}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {canAdd && (
          <TouchableOpacity
            onPress={onAdd}
            disabled={isUploading}
            style={[styles.photoThumb, {
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)',
              borderWidth: 1.5, borderStyle: 'dashed', borderColor: colorSet.border,
              alignItems: 'center', justifyContent: 'center',
            }]}
          >
            {isUploading ? (
              <ActivityIndicator color={colorSet.text} />
            ) : (
              <>
                <Text style={{ fontSize: 24, color: colorSet.text }}>+</Text>
                <Text style={{ fontSize: 10, color: colorSet.text, marginTop: 2 }}>Tambah</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Lightbox */}
      <Modal visible={!!previewUri} transparent animationType="fade">
        <TouchableOpacity style={styles.lightboxBg} onPress={() => setPreviewUri(null)} activeOpacity={1}>
          {previewUri && <Image source={{ uri: previewUri }} style={styles.lightboxImg} resizeMode="contain" />}
          <Text style={styles.lightboxClose}>✕ Tutup</Text>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export function PhotoPhaseGrid({
  sections,
  photoCounts,
  onAddPhoto,
  isUploading,
  uploadingRequirementId,
  uploadingPhase,
  isCompleted,
}: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  // Per-requirement mode
  if (photoCounts?.has_requirements && photoCounts.requirements.length > 0) {
    const allPhotos = sections.flatMap((s) => s.photos);
    return (
      <View style={{ gap: 12 }}>
        {photoCounts.requirements.map((req) => {
          const reqPhotos = allPhotos.filter((p) => p.photo_requirement_id === req.id);
          return (
            <RequirementGroup
              key={req.id}
              req={req}
              photos={reqPhotos}
              onAdd={() => onAddPhoto(req.phase as 'before' | 'during' | 'after', req.id)}
              isUploading={isUploading === true && uploadingRequirementId === req.id}
              isCompleted={isCompleted ?? false}
              isDark={isDark}
            />
          );
        })}
      </View>
    );
  }

  // Fallback: 3-phase mode (kunjungan tanpa template)
  return (
    <View style={{ gap: 16 }}>
      {sections.map(({ phase, photos, counts }) => {
        const colorSet = isDark ? PHASE_COLORS_DARK[phase] : PHASE_COLORS[phase];
        const filled = photos.length;
        const isPhaseUploading = isUploading && uploadingPhase === phase;
        const canAdd = !isCompleted && filled < counts.max;

        return (
          <View key={phase} style={{ backgroundColor: colorSet.bg, borderRadius: 16, borderWidth: 0.5, borderColor: colorSet.border, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colorSet.text }}>{PHASE_LABELS[phase]}</Text>
                <View style={{ backgroundColor: colorSet.border, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colorSet.text }}>{filled}/{counts.max}</Text>
                </View>
              </View>
              <Text style={{ fontSize: 11, color: filled >= counts.min ? '#34C759' : colorSet.text, fontWeight: '500' }}>
                {filled >= counts.min ? '✓ Min terpenuhi' : `Min ${counts.min} foto`}
              </Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
              {photos.map((photo, index) => (
                <TouchableOpacity key={photo.id} onPress={() => setPreviewUri(photo.watermarked_url)} style={styles.photoThumb}>
                  <Image source={{ uri: photo.thumbnail_url ?? photo.watermarked_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  <View style={styles.seqBadge}>
                    <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>#{index + 1}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {canAdd && (
                <TouchableOpacity
                  onPress={() => onAddPhoto(phase)}
                  disabled={!!isPhaseUploading}
                  style={[styles.photoThumb, {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)',
                    borderWidth: 1.5, borderStyle: 'dashed', borderColor: colorSet.border,
                    alignItems: 'center', justifyContent: 'center',
                  }]}
                >
                  {isPhaseUploading ? <ActivityIndicator color={colorSet.text} /> : (
                    <><Text style={{ fontSize: 24, color: colorSet.text }}>+</Text><Text style={{ fontSize: 10, color: colorSet.text, marginTop: 2 }}>Tambah</Text></>
                  )}
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        );
      })}

      <Modal visible={!!previewUri} transparent animationType="fade">
        <TouchableOpacity style={styles.lightboxBg} onPress={() => setPreviewUri(null)} activeOpacity={1}>
          {previewUri && <Image source={{ uri: previewUri }} style={styles.lightboxImg} resizeMode="contain" />}
          <Text style={styles.lightboxClose}>✕ Tutup</Text>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  photoThumb: { width: 96, height: 96, borderRadius: 12, overflow: 'hidden', backgroundColor: '#E5E7EB' },
  seqBadge: { position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  lightboxBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  lightboxImg: { width: '100%', height: '80%' },
  lightboxClose: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 16 },
});
