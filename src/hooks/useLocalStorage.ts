import { useState, useCallback, useEffect } from 'react';

/**
 * useLocalStorage — type-safe hook with cross-tab sync
 * Replaces scattered localStorage.getItem/setItem calls with a single reactive hook.
 *
 * Usage:
 *   const [value, setValue, removeValue] = useLocalStorage('key', defaultValue);
 */
export function useLocalStorage<T>(
    key: string,
    initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
    // Read from localStorage on mount (lazy initializer)
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = localStorage.getItem(key);
            return item !== null ? (JSON.parse(item) as T) : initialValue;
        } catch {
            return initialValue;
        }
    });

    // Write to localStorage whenever value changes
    const setValue = useCallback(
        (value: T | ((prev: T) => T)) => {
            setStoredValue((prev) => {
                const nextValue = value instanceof Function ? value(prev) : value;
                try {
                    localStorage.setItem(key, JSON.stringify(nextValue));
                    // Dispatch custom event so other components using the same key update
                    window.dispatchEvent(new CustomEvent('local-storage-change', { detail: { key } }));
                } catch (err) {
                    console.warn(`[useLocalStorage] Failed to set "${key}":`, err);
                }
                return nextValue;
            });
        },
        [key],
    );

    // Remove from localStorage
    const removeValue = useCallback(() => {
        try {
            localStorage.removeItem(key);
            setStoredValue(initialValue);
            window.dispatchEvent(new CustomEvent('local-storage-change', { detail: { key } }));
        } catch (err) {
            console.warn(`[useLocalStorage] Failed to remove "${key}":`, err);
        }
    }, [key, initialValue]);

    // Sync across tabs (native storage event) + same-tab (custom event)
    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {
            if (e.key === key) {
                try {
                    setStoredValue(e.newValue !== null ? JSON.parse(e.newValue) : initialValue);
                } catch {
                    setStoredValue(initialValue);
                }
            }
        };

        const handleCustom = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.key === key) {
                try {
                    const item = localStorage.getItem(key);
                    setStoredValue(item !== null ? JSON.parse(item) : initialValue);
                } catch {
                    setStoredValue(initialValue);
                }
            }
        };

        window.addEventListener('storage', handleStorage);
        window.addEventListener('local-storage-change', handleCustom);
        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('local-storage-change', handleCustom);
        };
    }, [key, initialValue]);

    return [storedValue, setValue, removeValue];
}
