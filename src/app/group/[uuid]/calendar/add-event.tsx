'use client';

import { useOptimistic, useTransition } from 'react';
import { addPublicEventToGroup } from '@/lib/groups/membership';

type Props = {
  groupId: string;
  eventId: string;
  alreadyAdded: boolean;
};

export function AddEventButton({ groupId, eventId, alreadyAdded }: Props) {
  const [pending, startTransition] = useTransition();
  const [optimisticAdded, setOptimisticAdded] = useOptimistic(alreadyAdded);

  function handleClick() {
    if (optimisticAdded) return;
    startTransition(async () => {
      setOptimisticAdded(true);
      await addPublicEventToGroup(groupId, eventId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={optimisticAdded || pending}
      aria-label={optimisticAdded ? 'Already added to group' : 'Add event to group'}
      className="ed-chip shrink-0"
      style={{
        opacity: optimisticAdded ? 0.5 : 1,
        cursor: optimisticAdded ? 'default' : 'pointer',
      }}
    >
      {optimisticAdded ? '✓ Added' : '+ Add'}
    </button>
  );
}
