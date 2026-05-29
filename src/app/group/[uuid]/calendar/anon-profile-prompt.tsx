'use client';

import { useState } from 'react';
import { setAnonProfile } from '@/lib/anon/profiles';

/**
 * Lightweight popover that lets an anon visitor pick an emoji + display name.
 * Shown only on group calendar pages. Skippable.
 */
export function AnonProfilePrompt() {
  const [open, setOpen] = useState(false);
  const [emoji, setEmoji] = useState('');
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await setAnonProfile('__cookie__', { emoji: emoji || undefined, displayName: name || undefined });
    setSaved(true);
    setOpen(false);
  }

  if (saved) return null;

  return (
    <div className="u-mono" style={{ color: 'var(--ed-fg-soft)' }}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="hover:text-[color:var(--ed-fg)]"
          aria-label="Set your emoji and display name"
        >
          👋 Pick an emoji and name
        </button>
      ) : (
        <form
          onSubmit={handleSave}
          className="flex flex-wrap items-center gap-3 rounded border border-[color:var(--ed-line)] p-4"
        >
          <input
            type="text"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="Emoji"
            maxLength={2}
            className="w-16 rounded border border-[color:var(--ed-line)] bg-transparent px-2 py-1 text-center"
            aria-label="Your emoji"
          />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Display name"
            maxLength={32}
            className="rounded border border-[color:var(--ed-line)] bg-transparent px-2 py-1"
            aria-label="Your display name"
          />
          <button type="submit" className="ed-chip">
            Save
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="opacity-60 hover:opacity-100"
          >
            Skip
          </button>
        </form>
      )}
    </div>
  );
}
