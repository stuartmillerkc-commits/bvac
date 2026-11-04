import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TeamFinder } from '@/components/family/TeamFinder';

export const metadata: Metadata = { title: 'Team Finder · BVAC Team Builder' };

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Loading team options…</p>}>
      <TeamFinder />
    </Suspense>
  );
}
