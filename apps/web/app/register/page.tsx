import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RegisterForm } from '@/components/family/RegisterForm';

export const metadata: Metadata = { title: 'Register (SportsEngine mock) · BVAC Team Builder' };

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Loading the registration form…</p>}>
      <RegisterForm />
    </Suspense>
  );
}
