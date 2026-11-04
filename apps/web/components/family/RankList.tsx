'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import s from './family.module.css';

export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'}`;
}

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item === undefined) return next;
  next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
  return next;
}

/**
 * A ranked list people can reorder three ways: drag the handle (mouse or
 * touch), focus the handle and press the arrow keys, or use the Move up /
 * Move down buttons. Moves are announced to screen readers.
 */
export function RankList<T>({
  items,
  getKey,
  getLabel,
  onChange,
  renderItem,
  renderActions,
  label,
}: {
  items: readonly T[];
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  onChange: (next: T[]) => void;
  renderItem: (item: T, index: number) => ReactNode;
  renderActions?: (item: T, index: number) => ReactNode;
  label: string;
}) {
  const [announcement, setAnnouncement] = useState('');
  const [dragKey, setDragKey] = useState<string | null>(null);
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const handleRefs = useRef(new Map<string, HTMLButtonElement>());
  const focusAfterMove = useRef<string | null>(null);
  // Latest items for the window-level drag listeners.
  const latest = useRef({ items, onChange });
  latest.current = { items, onChange };

  useEffect(() => {
    const key = focusAfterMove.current;
    if (key) {
      focusAfterMove.current = null;
      handleRefs.current.get(key)?.focus();
    }
  });

  const move = (from: number, to: number, viaKeyboard: boolean) => {
    if (to < 0 || to >= items.length || from === to) return;
    const item = items[from]!;
    if (viaKeyboard) focusAfterMove.current = getKey(item);
    onChange(moveItem(items, from, to));
    setAnnouncement(`${getLabel(item)} moved to ${ordinal(to + 1)} of ${items.length}.`);
  };

  const onHandleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      move(i, i - 1, true);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      move(i, i + 1, true);
    } else if (e.key === 'Home') {
      e.preventDefault();
      move(i, 0, true);
    } else if (e.key === 'End') {
      e.preventDefault();
      move(i, items.length - 1, true);
    }
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>, key: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setDragKey(key);
    const onMove = (ev: globalThis.PointerEvent) => {
      const { items: current, onChange: change } = latest.current;
      const from = current.findIndex((it) => getKey(it) === key);
      if (from < 0) return;
      // Target index = how many other items have their middle above the pointer.
      let to = 0;
      current.forEach((it, idx) => {
        if (idx === from) return;
        const rect = itemRefs.current.get(getKey(it))?.getBoundingClientRect();
        if (rect && rect.top + rect.height / 2 < ev.clientY) to++;
      });
      if (to !== from) change(moveItem(current, from, to));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setDragKey(null);
      const { items: current } = latest.current;
      const at = current.findIndex((it) => getKey(it) === key);
      if (at >= 0) setAnnouncement(`${getLabel(current[at]!)} is now ${ordinal(at + 1)} of ${current.length}.`);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  return (
    <>
      <ol className={s.rankList} aria-label={label}>
        {items.map((item, i) => {
          const key = getKey(item);
          const name = getLabel(item);
          return (
            <li
              key={key}
              className={s.rankItem}
              data-dragging={dragKey === key ? 'true' : undefined}
              ref={(el) => {
                if (el) itemRefs.current.set(key, el);
                else itemRefs.current.delete(key);
              }}
            >
              <button
                type="button"
                className={s.handle}
                aria-label={`${name}, ${ordinal(i + 1)} of ${items.length}. Drag, or use arrow keys to move.`}
                onKeyDown={(e) => onHandleKeyDown(e, i)}
                onPointerDown={(e) => onPointerDown(e, key)}
                ref={(el) => {
                  if (el) handleRefs.current.set(key, el);
                  else handleRefs.current.delete(key);
                }}
              >
                <span aria-hidden="true">⠿</span>
              </button>
              <span className={s.rankNum} aria-hidden="true">
                {ordinal(i + 1)}
              </span>
              <div className={s.rankBody}>{renderItem(item, i)}</div>
              <div className={s.rankActions}>
                <button
                  type="button"
                  className={s.iconButton}
                  onClick={() => move(i, i - 1, false)}
                  disabled={i === 0}
                  aria-label={`Move ${name} up`}
                >
                  <span aria-hidden="true">↑</span>
                </button>
                <button
                  type="button"
                  className={s.iconButton}
                  onClick={() => move(i, i + 1, false)}
                  disabled={i === items.length - 1}
                  aria-label={`Move ${name} down`}
                >
                  <span aria-hidden="true">↓</span>
                </button>
                {renderActions?.(item, i)}
              </div>
            </li>
          );
        })}
      </ol>
      <div className={s.srOnly} aria-live="polite">
        {announcement}
      </div>
    </>
  );
}
