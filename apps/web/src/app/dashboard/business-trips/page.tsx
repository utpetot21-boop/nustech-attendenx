'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BusinessTripsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/keuangan'); }, [router]);
  return null;
}
