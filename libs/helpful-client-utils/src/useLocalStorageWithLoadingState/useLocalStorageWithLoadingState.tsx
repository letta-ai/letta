import { useEffect, useState } from 'react';

export function useLocalStorageWithLoadingState<T>(
  key: string,
  initialValue: T
): [T, (nextValue: T) => void, boolean] {
  const [value, setValue] = useState<T>(() => {
    const storedValue = localStorage.getItem(key);
    return storedValue ? JSON.parse(storedValue) : initialValue;
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedValue = localStorage.getItem(key);
    if (storedValue) {
      setValue(JSON.parse(storedValue));
    }
    setLoading(false);
  }, [key]);

  function setStoredValue(newValue: T) {
    localStorage.setItem(key, JSON.stringify(newValue));
    setValue(newValue);
  }

  return [value, setStoredValue, loading];
}
