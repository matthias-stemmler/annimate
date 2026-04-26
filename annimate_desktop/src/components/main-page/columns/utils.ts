import { AnnoKey } from '@/lib/api-types';

export const annoKeyToValue = (annoKey: AnnoKey): string =>
  `${annoKey.ns}:${annoKey.name}`;

// Safe because ANNIS annotation names do not contain colons, and `value` is
// produced by `annoKeyToValue` joining `ns` and `name` with a single `:`.
export const valueToAnnoKey = (value: string): AnnoKey => {
  const [ns, name] = value.split(':', 2);
  return { ns, name };
};
