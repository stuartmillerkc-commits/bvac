import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SettingsForm } from '@/components/admin/SettingsForm';

export const metadata: Metadata = { title: 'Division settings · BVAC Team Builder' };

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <SettingsForm />
    </Suspense>
  );
}
