import type { Metadata } from 'next';
import { ExportsPage } from '@/components/admin/ExportsPage';

export const metadata: Metadata = { title: 'Exports for SportsEngine · BVAC Team Builder' };

export default function Page() {
  return <ExportsPage />;
}
