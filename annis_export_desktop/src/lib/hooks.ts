import { useEffect, useState } from 'react';

export const useDebounce = <T>(
  value: T,
  delay: number,
  shouldDebounce: boolean = true,
): T => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    if (shouldDebounce) {
      const handle = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);

      return () => {
        clearTimeout(handle);
      };
    } else {
      setDebouncedValue(value);
    }
  }, [delay, shouldDebounce, value]);

  return shouldDebounce ? debouncedValue : value;
};
