import type { Metadata } from 'next';
import { Tour } from '@/components/Tour';

export const metadata: Metadata = { title: 'Guided tour · BVAC Team Builder' };

export default function Page() {
  return <Tour />;
}
