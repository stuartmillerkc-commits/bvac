'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/finder/', label: 'Team Finder' },
  { href: '/register/', label: 'Register (mock)' },
  { href: '/preferences/', label: 'Preferences' },
  { href: '/coach/', label: 'Coach' },
  { href: '/admin/', label: 'Admin' },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            BV
          </span>
          BVAC Team Builder
        </Link>
        <nav className="nav" aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={pathname?.startsWith(l.href) ? 'page' : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
