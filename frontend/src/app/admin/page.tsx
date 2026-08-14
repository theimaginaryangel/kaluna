'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { isCreatorMode, isAdminMode } from '@/lib/api';

export default function AdminPage() {
  const router = useRouter();
  
  React.useEffect(() => {
    const hasToken =
      typeof window !== 'undefined' && Boolean(window.localStorage.getItem('kaluna_jwt_token'));
    if (hasToken && (isCreatorMode() || isAdminMode())) {
      router.replace('/admin/dashboard');
    } else {
      router.replace('/admin/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-slate-300 dark:border-slate-700 border-t-[#FF2D87] animate-spin" />
    </div>
  );
}
