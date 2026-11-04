import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CoachView } from '@/components/admin/CoachView';

export const metadata: Metadata = { title: 'Coach view · BVAC Team Builder' };

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Loading the coach view…</p>}>
      <CoachView />
    </Suspense>
  );
}
