import { cache } from 'react';

/**
 * Request-scoped wall clock for use inside React Server Components.
 *
 * Wrapping `Date.now()` in React's `cache()` gives every call within a
 * single request the same value, which satisfies the React Compiler's
 * "no impure function during render" rule. Different requests still get
 * different timestamps; this is not a global memo.
 */
export const now = cache((): number => Date.now());
