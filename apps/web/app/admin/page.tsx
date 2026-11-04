import type { Metadata } from 'next';
import { Dashboard } from '@/components/admin/Dashboard';

export const metadata: Metadata = { title: 'Admin dashboard · BVAC Team Builder' };

export default function Page() {
  return <Dashboard />;
}
