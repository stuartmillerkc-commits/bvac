import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Preferences } from '@/components/family/Preferences';

export const metadata: Metadata = { title: 'Team preferences · BVAC Team Builder' };

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Loading preferences…</p>}>
      <Preferences />
    </Suspense>
  );
}
