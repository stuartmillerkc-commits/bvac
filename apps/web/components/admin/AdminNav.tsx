'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Division } from '@bvac/core';
import './admin.css';

const TABS = [
  { href: '/admin/', label: 'Dashboard', exact: true },
  { href: '/admin/board/', label: 'Team board' },
  { href: '/admin/compare/', label: 'Compare' },
  { href: '/admin/settings/', label: 'Settings' },
  { href: '/admin/import/', label: 'Import' },
  { href: '/admin/exports/', label: 'Exports' },
];

export function AdminNav() {
  const pathname = usePathname() ?? '';
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return (
    <nav className="adm-tabs" aria-label="Admin">
      {TABS.map((t) => {
        const active = t.exact ? path.endsWith(t.href) : path.includes(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Division links that keep the current page and set `?d=`. */
export function DivisionPills({
  divisions,
  current,
  hrefFor,
  label = 'Division',
}: {
  divisions: Division[];
  current: Division | undefined;
  hrefFor: (d: Division) => string;
  label?: string;
}) {
  return (
    <nav className="adm-pills" aria-label={label}>
      {divisions.map((d) => (
        <Link key={d.id} href={hrefFor(d)} aria-current={current?.id === d.id ? 'page' : undefined} title={`${d.name}: ${d.label}`}>
          {d.code}
        </Link>
      ))}
    </nav>
  );
}

export function AdminHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <>
      <AdminNav />
      <div className="adm-spread" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>{title}</h1>
        {children}
      </div>
    </>
  );
}
