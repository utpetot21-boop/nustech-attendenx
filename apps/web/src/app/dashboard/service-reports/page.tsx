'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ServiceReportsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/tasks?tab=ba'); }, [router]);
  return null;
}
