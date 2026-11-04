/**
 * Neutral placeholder mark: a rounded tile with a simple field (halfway line
 * and center circle). Not BVAC's logo; swap it once BVAC approves a mark.
 * The same drawing is in app/icon.svg.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <rect x="6.5" y="9" width="19" height="14" rx="2" fill="none" stroke="var(--color-primary-contrast, #fff)" strokeWidth="1.75" />
      <path d="M16 9v14" stroke="var(--color-primary-contrast, #fff)" strokeWidth="1.75" />
      <circle cx="16" cy="16" r="3" fill="none" stroke="var(--color-primary-contrast, #fff)" strokeWidth="1.75" />
    </svg>
  );
}
