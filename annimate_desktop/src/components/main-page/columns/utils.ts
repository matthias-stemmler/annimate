import { AnnoKey } from '@/lib/api-types';

export const annoKeyToValue = (annoKey: AnnoKey): string =>
  `${annoKey.ns}:${annoKey.name}`;

export const valueToAnnoKey = (value: string): AnnoKey => {
  const [ns, name] = value.split(':', 2);
  return { ns, name };
};
