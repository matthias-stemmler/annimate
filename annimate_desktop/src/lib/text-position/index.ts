/**
 * Text position calculation utilities for converting between
 * Rust backend code-point-based positions and browser-compatible
 * character indices.
 *
 * The Rust backend reports positions using Unicode code points,
 * but browser APIs like `setSelectionRange` expect UTF-16 code units.
 * These functions bridge that gap, accounting for multi-code-point
 * grapheme clusters (e.g., emoji with skin tone modifiers, combining
 * diacritical marks) so that caret positioning and selection ranges
 * align with what the user sees.
 */

const GRAPHEME_SEGMENTER = new Intl.Segmenter(undefined, {
  granularity: 'grapheme',
});

/**
 * Converts a line:column position (as reported by the Rust backend)
 * to an absolute character index in a multiline string.
 *
 * The column index is in Unicode code points (per the Rust backend),
 * but `setSelectionRange` expects UTF-16 code units. Spreading the
 * line splits it into code points so non-BMP characters like emojis
 * count as one column.
 *
 * @param lineIndex - Zero-based line number
 * @param columnIndex - Zero-based column number in Unicode code points
 * @param text - The multiline string to index into
 * @returns Absolute UTF-16 code unit offset from the start of the string
 */
export const lineColumnToCharacterIndex = (
  lineIndex: number,
  columnIndex: number,
  text: string,
): number => {
  const lines = text.split('\n');
  const numCharsBeforeLine = computeCharactersBeforeLine(lines, lineIndex);
  const columnOffset = computeColumnOffsetInUtf16(lines[lineIndex] ?? '', columnIndex);

  return numCharsBeforeLine + columnOffset;
};

/**
 * Converts a code-point-based column index (as produced by the Rust
 * backend) to a grapheme-cluster column index, so that displayed
 * positions count the same way the textarea moves the caret/selection
 * on cursor keys.
 *
 * For example, the sequence "café" has 4 code points but the "é" may
 * be represented as "e\u0301" (2 code points), making 5 total. This
 * function returns the number of visible grapheme positions, which
 * is what the user experiences when pressing arrow keys.
 *
 * @param line - The line of text to measure
 * @param columnIndex - Column index in Unicode code points
 * @returns Column index in grapheme clusters
 */
export const columnIndexCodePointsToGraphemes = (
  line: string,
  columnIndex: number,
): number => {
  const prefix = extractCodePointPrefix(line, columnIndex);
  return countGraphemeClusters(prefix);
};

// --- Internal helpers ---

/**
 * Computes the total number of UTF-16 code units before the given
 * line, including the newline characters that separate lines.
 */
const computeCharactersBeforeLine = (
  lines: string[],
  lineIndex: number,
): number =>
  lines.slice(0, lineIndex).reduce(
    (acc, line) => acc + line.length + '\n'.length,
    0,
  );

/**
 * Converts a code-point-based column offset to a UTF-16 code unit
 * offset within a single line, handling surrogate pairs correctly.
 */
const computeColumnOffsetInUtf16 = (
  line: string,
  columnIndex: number,
): number => [...line].slice(0, columnIndex).join('').length;

/**
 * Extracts the prefix of a line up to the given code-point-based
 * column index, splitting the string by code points.
 */
const extractCodePointPrefix = (line: string, columnIndex: number): string =>
  [...line].slice(0, columnIndex).join('');

/**
 * Counts the number of grapheme clusters in a string using
 * Intl.Segmenter, which accounts for combining characters,
 * emoji sequences, and other multi-code-point graphemes.
 */
const countGraphemeClusters = (text: string): number =>
  [...GRAPHEME_SEGMENTER.segment(text)].length;
