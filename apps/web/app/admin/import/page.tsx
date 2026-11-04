import type { Metadata } from 'next';
import { ImportPage } from '@/components/admin/ImportPage';

export const metadata: Metadata = { title: 'Import from SportsEngine · BVAC Team Builder' };

export default function Page() {
  return <ImportPage />;
}
