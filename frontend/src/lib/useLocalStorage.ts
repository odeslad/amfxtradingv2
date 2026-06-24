import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';

// Persists a piece of UI state in localStorage, JSON-serialised. Reads once on
// mount with a fallback to `defaultValue` (also used when the stored value is
// missing or corrupt), and writes on every change. The setter mirrors useState,
// so it accepts both a value and an updater function.
export function useLocalStorage<T>(key: string, defaultValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full or unavailable — ignore, state still works in memory
    }
  }, [key, value]);

  return [value, setValue];
}
