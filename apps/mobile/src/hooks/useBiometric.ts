import { useState, useCallback, useRef } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricResult =
  | { success: true; method: 'face_id' | 'fingerprint' }
  | { success: false; fallbackToPin: boolean; error: string };

/**
 * Verifikasi biometrik (Face ID / Fingerprint) via expo-local-authentication.
 * Verifikasi terjadi SEPENUHNYA di device — tidak ada data biometrik dikirim ke server.
 * Jika gagal 3x → fallback ke PIN 6 digit.
 */
export function useBiometric() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [failCount, setFailCount] = useState(0);
  // L3: ref untuk baca failCount tanpa memasukkannya ke dep array verify
  //     — cegah verify di-recreate setiap kali failCount berubah
  const failCountRef = useRef(0);
  const MAX_FAIL = 3;

  const checkSupport = useCallback(async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

    const hasFaceId = supportedTypes.includes(
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
    );
    const hasFingerprint = supportedTypes.includes(
      LocalAuthentication.AuthenticationType.FINGERPRINT,
    );

    return {
      supported: hasHardware && isEnrolled,
      hasFaceId,
      hasFingerprint,
    };
  }, []);

  const verify = useCallback(async (): Promise<BiometricResult> => {
    setIsVerifying(true);

    try {
      const { supported, hasFaceId } = await checkSupport();

      if (!supported) {
        return {
          success: false,
          fallbackToPin: true,
          error: 'Biometrik tidak tersedia di perangkat ini',
        };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verifikasi identitas untuk check-in',
        cancelLabel: 'Gunakan PIN',
        fallbackLabel: 'Gunakan PIN',
        disableDeviceFallback: false,
      });

      if (result.success) {
        failCountRef.current = 0;
        setFailCount(0);
        const method = hasFaceId ? 'face_id' : 'fingerprint';
        return { success: true, method };
      }

      // Gagal
      const newFailCount = failCountRef.current + 1;
      failCountRef.current = newFailCount;
      setFailCount(newFailCount);

      if (newFailCount >= MAX_FAIL) {
        failCountRef.current = 0;
        setFailCount(0);
        return {
          success: false,
          fallbackToPin: true,
          error: `Verifikasi gagal ${MAX_FAIL}x. Gunakan PIN.`,
        };
      }

      return {
        success: false,
        fallbackToPin: false,
        error: `Verifikasi gagal. Sisa ${MAX_FAIL - newFailCount} percobaan.`,
      };
    } catch {
      return {
        success: false,
        fallbackToPin: true,
        error: 'Error biometrik. Gunakan PIN.',
      };
    } finally {
      setIsVerifying(false);
    }
  }, [checkSupport]); // failCountRef tidak perlu di deps — dibaca via ref

  const resetFailCount = useCallback(() => {
    failCountRef.current = 0;
    setFailCount(0);
  }, []);

  return { verify, checkSupport, isVerifying, failCount, resetFailCount };
}
