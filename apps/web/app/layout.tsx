import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/SiteHeader';
import { SeasonProvider } from '@/lib/season-store';
import './globals.css';

export const metadata: Metadata = {
  title: 'BVAC Team Builder',
  description: 'Team placement and scheduling companion for BVAC youth sports, built to work alongside SportsEngine.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="demo-banner">Demo with a made-up Spring 2027 season. No real families or players.</div>
        <SiteHeader />
        <SeasonProvider>
          <main className="page">{children}</main>
        </SeasonProvider>
        <footer className="site-footer">
          An independent proposal by a BVAC parent, not an official BVAC or SportsEngine product. Registration and payment stay in
          SportsEngine.
        </footer>
      </body>
    </html>
  );
}
