import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Compare } from '@/components/admin/Compare';

export const metadata: Metadata = { title: 'Compare scenarios · BVAC Team Builder' };

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <Compare />
    </Suspense>
  );
}
