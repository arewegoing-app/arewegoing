'use client';

import { FEATURE_REGISTRY } from '@/lib/feature_interest/registry';
import { NotifyMeButton } from '@/components/notify-me-button';

type ConnectChip = {
  featureKey: string;
  index: string;
};

const CHIPS: ConnectChip[] = [
  { featureKey: 'connect.facebook', index: '[01]' },
  { featureKey: 'connect.songkick', index: '[02]' },
  { featureKey: 'connect.soundcloud', index: '[03]' },
  { featureKey: 'connect.spotify', index: '[04]' },
];

export function ConnectRow() {
  return (
    <ul
      className="grid grid-cols-2 gap-px bg-[color:var(--ed-line)] border border-[color:var(--ed-line)] sm:grid-cols-4"
      aria-label="Connect your accounts"
    >
      {CHIPS.map(({ featureKey, index }) => {
        const { tagline } = FEATURE_REGISTRY[featureKey] ?? {};
        // Derive a short display name from the feature key, e.g. "connect.facebook" → "Facebook"
        const shortName = featureKey.split('.')[1];
        const displayName =
          shortName.charAt(0).toUpperCase() + shortName.slice(1);

        return (
          <li
            key={featureKey}
            className="ed-card flex flex-col gap-2 p-4"
            style={{ border: '0' }}
          >
            <div className="u-mono opacity-50">{index}</div>
            <div
              className="u-display"
              style={{ fontSize: 'clamp(1rem, 3vw, 1.5rem)', lineHeight: 1 }}
            >
              {displayName}
            </div>
            {tagline && (
              <p
                className="u-mono leading-relaxed"
                style={{ color: 'var(--ed-fg-soft)', textTransform: 'none' }}
              >
                {tagline}
              </p>
            )}
            <div className="mt-auto pt-2">
              <NotifyMeButton
                featureKey={featureKey}
                label={displayName}
                redirectOnSuccess={true}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
