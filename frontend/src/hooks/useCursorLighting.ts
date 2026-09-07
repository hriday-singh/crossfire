import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "crossfire_cursor_lighting";
const EVENT_NAME = "crossfire-cursor-lighting-change";

/**
 * Custom hook to get and toggle the Cursor Lighting feature.
 * Synchronizes with localStorage and broadcasts changes across components.
 */
export function useCursorLighting() {
  const [enabled, setEnabledState] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue !== null) {
        setEnabledState(e.newValue === "true");
      }
    };

    const handleCustom = (e: Event) => {
      const detail = (e as CustomEvent<{ enabled: boolean }>).detail;
      if (detail && typeof detail.enabled === "boolean") {
        setEnabledState(detail.enabled);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(EVENT_NAME, handleCustom);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(EVENT_NAME, handleCustom);
    };
  }, []);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // ignore
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(EVENT_NAME, { detail: { enabled: value } })
      );
    }
  }, []);

  return { isEnabled: enabled, setEnabled };
}
