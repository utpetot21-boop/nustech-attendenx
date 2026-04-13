import { useState, useEffect, useCallback } from 'react';

interface TimerState {
  canCheckout: boolean;
  remainingSeconds: number;
  displayTime: string; // "5j 23m 10d"
  checkedOut: boolean;
}

/**
 * Hook countdown timer untuk checkout.
 * checkout_earliest = check_in_at + 8 jam
 * Tombol checkout terkunci sampai remainingSeconds = 0
 */
export function useCheckoutTimer(checkoutEarliest: Date | string | null, checkedOut: boolean): TimerState {
  const calcState = useCallback((): TimerState => {
    if (checkedOut) {
      return { canCheckout: false, remainingSeconds: 0, displayTime: '—', checkedOut: true };
    }

    if (!checkoutEarliest) {
      return { canCheckout: false, remainingSeconds: 0, displayTime: '—', checkedOut: false };
    }

    const earliest = typeof checkoutEarliest === 'string'
      ? new Date(checkoutEarliest)
      : checkoutEarliest;

    const now = new Date();
    const remainingMs = earliest.getTime() - now.getTime();

    if (remainingMs <= 0) {
      return { canCheckout: true, remainingSeconds: 0, displayTime: 'Tersedia', checkedOut: false };
    }

    const remainingSec = Math.ceil(remainingMs / 1000);
    const hours = Math.floor(remainingSec / 3600);
    const minutes = Math.floor((remainingSec % 3600) / 60);
    const seconds = remainingSec % 60;

    const displayTime = hours > 0
      ? `${hours}j ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`
      : `${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;

    return { canCheckout: false, remainingSeconds: remainingSec, displayTime, checkedOut: false };
  }, [checkoutEarliest, checkedOut]);

  const [state, setState] = useState<TimerState>(calcState);

  useEffect(() => {
    setState(calcState());

    if (checkedOut || !checkoutEarliest) return;

    const earliest = typeof checkoutEarliest === 'string'
      ? new Date(checkoutEarliest)
      : checkoutEarliest;

    if (new Date() >= earliest) return;

    const interval = setInterval(() => {
      const next = calcState();
      setState(next);
      if (next.canCheckout) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [checkoutEarliest, checkedOut, calcState]);

  return state;
}
