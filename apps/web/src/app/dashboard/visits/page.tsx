'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function VisitsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/tasks?tab=visits'); }, [router]);
  return null;
}
