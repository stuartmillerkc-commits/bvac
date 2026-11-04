import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Board } from '@/components/admin/Board';

export const metadata: Metadata = { title: 'Team board · BVAC Team Builder' };

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Loading the team board…</p>}>
      <Board />
    </Suspense>
  );
}
