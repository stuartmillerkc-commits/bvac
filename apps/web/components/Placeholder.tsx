import type { ReactNode } from 'react';

/** Marks a page another build task will fill in. Delete once the page is real. */
export function Placeholder({ task, title, children }: { task: string; title: string; children: ReactNode }) {
  return (
    <div className="card">
      <span className="badge warning">{task}</span>
      <h1 style={{ marginTop: 12 }}>{title}</h1>
      <div className="muted">{children}</div>
    </div>
  );
}
