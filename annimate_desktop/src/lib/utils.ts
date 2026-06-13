/**
 * Shared utility functions for the annimate desktop application.
 *
 * This module serves as a centralized re-export hub for utility
 * functions organized by domain:
 *
 * - `text-position` — Text cursor/position calculation (code points ↔ graphemes)
 * - `collection` — Array/collection transformation helpers (groupBy, uniq, filterEligible)
 * - `formatting` — Value display formatting (formatPercentage)
 *
 * The `cn` function remains here as it is a UI-specific helper that
 * bridges the clsx and tailwind-merge libraries — it does not belong
 * to any of the above domains.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Re-export from domain modules for backward compatibility
export {
  lineColumnToCharacterIndex,
  columnIndexCodePointsToGraphemes,
} from './text-position/index';

export { filterEligible, groupBy, uniq } from './collection/index';

export { formatPercentage } from './formatting/index';

/**
 * Merges CSS class names using clsx and tailwind-merge.
 *
 * This function first passes all inputs through `clsx` to handle
 * conditional class name logic (arrays, objects, falsy values),
 * then passes the result through `twMerge` to intelligently resolve
 * Tailwind CSS class conflicts (e.g., `cn('px-2', 'px-4')` → `'px-4'`).
 *
 * @param inputs - Class values in any format accepted by clsx
 * @returns Merged class string with Tailwind conflicts resolved
 */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
