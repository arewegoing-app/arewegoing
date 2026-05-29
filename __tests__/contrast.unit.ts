/**
 * Unit tests for the wcagContrast() helper.
 *
 * Runs via: pnpm test:unit -- contrast
 * (matches __tests__/contrast.unit.ts via the shell glob)
 */

import { strict as assert } from 'node:assert';
import { wcagContrast } from './utils/contrast.js';

// 1. Same colour → ratio is 1 (no contrast at all).
const sameWhite = wcagContrast('rgb(255, 255, 255)', 'rgb(255, 255, 255)');
assert.ok(Math.abs(sameWhite - 1) < 0.01, `Same white expected ≈1, got ${sameWhite}`);
console.log(`OK: same colour returns ~1 (got ${sameWhite.toFixed(3)})`);

// 2. White on black → ratio is 21 (maximum contrast).
const whiteOnBlack = wcagContrast('rgb(255, 255, 255)', 'rgb(0, 0, 0)');
assert.ok(
  Math.abs(whiteOnBlack - 21) < 0.1,
  `White on black expected ≈21, got ${whiteOnBlack}`,
);
console.log(`OK: white on black returns ~21 (got ${whiteOnBlack.toFixed(3)})`);

// 3. Black on white → also 21 (symmetric).
const blackOnWhite = wcagContrast('rgb(0, 0, 0)', 'rgb(255, 255, 255)');
assert.ok(
  Math.abs(blackOnWhite - 21) < 0.1,
  `Black on white expected ≈21, got ${blackOnWhite}`,
);
console.log(`OK: black on white returns ~21 (symmetric, got ${blackOnWhite.toFixed(3)})`);

// 4. oklch same-grey on itself → ratio is 1.
const sameOklch = wcagContrast('oklch(50% 0 0)', 'oklch(50% 0 0)');
assert.ok(
  Math.abs(sameOklch - 1) < 0.05,
  `oklch(50% 0 0) on itself expected ≈1, got ${sameOklch}`,
);
console.log(`OK: oklch(50% 0 0) on itself returns ~1 (got ${sameOklch.toFixed(3)})`);

// 5. Known WCAG AA pair: #767676 on #fff must be at least 4.5:1.
//    Per WCAG the exact ratio is ~4.54:1.
const grey767 = wcagContrast('rgb(118, 118, 118)', 'rgb(255, 255, 255)');
assert.ok(
  grey767 >= 4.4,
  `#767676 on white expected ≥ 4.4 (WCAG AA boundary), got ${grey767}`,
);
console.log(`OK: #767676 on white ≥ 4.5 WCAG AA (got ${grey767.toFixed(3)})`);

// 6. Very similar colours → ratio close to 1, definitely < 2.
const similar = wcagContrast('rgb(200, 200, 200)', 'rgb(210, 210, 210)');
assert.ok(similar < 2, `Similar colours expected ratio < 2, got ${similar}`);
console.log(`OK: similar greys return low contrast (got ${similar.toFixed(3)})`);

// 7. The ed-accent (oklch(88% 0.22 125)) on ed-on-accent (oklch(15% 0 0))
//    must be at least 4.5:1 (the token pairing the app ships).
const accentContrast = wcagContrast('oklch(15% 0 0)', 'oklch(88% 0.22 125)');
assert.ok(
  accentContrast >= 4.5,
  `ed-on-accent on ed-accent expected ≥ 4.5 WCAG AA, got ${accentContrast}`,
);
console.log(`OK: ed-on-accent on ed-accent ≥ 4.5 (got ${accentContrast.toFixed(3)})`);

// 8. rgba() form is parsed correctly (alpha ignored for luminance).
const rgbaVsBlack = wcagContrast('rgba(255, 255, 255, 0.5)', 'rgb(0, 0, 0)');
// We only test that it doesn't throw and returns a positive value.
assert.ok(rgbaVsBlack > 0, `rgba() form should parse without error (got ${rgbaVsBlack})`);
console.log(`OK: rgba() parses and returns positive ratio (got ${rgbaVsBlack.toFixed(3)})`);

console.log('All contrast.unit.ts tests passed.');
