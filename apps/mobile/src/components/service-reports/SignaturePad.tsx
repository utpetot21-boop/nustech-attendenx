import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import SignatureScreen, { SignatureViewRef } from 'react-native-signature-canvas';

interface SignaturePadProps {
  title?: string;
  onSave: (base64: string) => void;
  onCancel: () => void;
}

export function SignaturePad({ title = 'Tanda Tangan', onSave, onCancel }: SignaturePadProps) {
  const ref = useRef<SignatureViewRef>(null);

  const handleOK = (sig: string) => {
    if (!sig || sig === 'data:image/png;base64,') {
      Alert.alert('Perhatian', 'Tanda tangan kosong, silakan tanda tangan terlebih dahulu.');
      return;
    }
    onSave(sig);
  };

  const handleEmpty = () => {
    Alert.alert('Perhatian', 'Tanda tangan kosong');
  };

  const handleClear = () => {
    ref.current?.clearSignature();
  };

  const handleConfirm = () => {
    ref.current?.readSignature();
  };

  const webStyle = `
    .m-signature-pad {
      box-shadow: none;
      border: none;
    }
    .m-signature-pad--body {
      border: 2px dashed #d1d5db;
      border-radius: 16px;
      background: #f9fafb;
    }
    .m-signature-pad--footer { display: none; }
    body { margin: 0; background: transparent; }
  `;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.cancelBtn}>Batal</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>Tanda tangan di area bawah ini</Text>

      <View style={styles.padContainer}>
        <SignatureScreen
          ref={ref}
          onOK={handleOK}
          onEmpty={handleEmpty}
          webStyle={webStyle}
          autoClear={false}
          descriptionText=""
          clearText="Hapus"
          confirmText="Simpan"
          backgroundColor="transparent"
          penColor="#1a1a1a"
          minWidth={2}
          maxWidth={4}
        />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
          <Text style={styles.clearBtnText}>Ulangi</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
          <Text style={styles.confirmBtnText}>Simpan Tanda Tangan</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  cancelBtn: {
    fontSize: 15,
    color: '#6b7280',
  },
  hint: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 12,
  },
  padContainer: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    backgroundColor: '#f9fafb',
    minHeight: 260,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  clearBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  clearBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4b5563',
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
