'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ExpenseClaimsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/keuangan?tab=claims'); }, [router]);
  return null;
}
