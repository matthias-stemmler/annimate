import { AnnoKey } from '@/lib/api';

export const annoKeyToValue = (annoKey: AnnoKey): string =>
  `${annoKey.ns}:${annoKey.name}`;

export const valueToAnnoKey = (value: string): AnnoKey => {
  const [ns, name] = value.split(':');
  return { ns, name };
};
