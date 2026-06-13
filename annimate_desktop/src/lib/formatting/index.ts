/**
 * Formatting utilities for displaying values in the UI.
 *
 * Each function in this module is a pure formatter that converts a
 * raw value into a human-readable string suitable for display. All
 * formatters are locale-aware where applicable.
 */

const LOCALE = 'en-US';

const PERCENTAGE_FORMAT = new Intl.NumberFormat(LOCALE, {
  style: 'percent',
});

/**
 * Formats a decimal number as a percentage string using the
 * application's configured locale.
 *
 * The input value should be a decimal between 0 and 1, where
 * 0.5 represents 50%. Values outside this range are formatted
 * as-is by Intl.NumberFormat (e.g., 1.5 → "150%").
 *
 * @param value - The decimal value to format (e.g., 0.5 for 50%)
 * @returns The locale-formatted percentage string
 */
export const formatPercentage = (value: number): string =>
  PERCENTAGE_FORMAT.format(value);
