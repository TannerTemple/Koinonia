import { useCallback, useEffect, useRef, useState } from "react";
import { longText } from "./storage";

/**
 * Text that survives a dropped connection, a failed save, a phone call or the app being
 * closed: it is written to the phone a moment after each change and restored next time
 * the same form opens. Call `clear()` once it has been saved for real.
 *
 * `restored` is true when the form opened with a saved draft, so it can say so.
 */
export function useDraft(key: string | null, initial = "") {
  const [value, setValue] = useState(initial);
  const [ready, setReady] = useState(key === null);
  const [restored, setRestored] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleared = useRef(false);

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    void longText.get(key).then((saved) => {
      if (cancelled) return;
      if (saved) {
        setValue(saved);
        setRestored(true);
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const change = useCallback(
    (next: string) => {
      setValue(next);
      if (key === null) return;
      cleared.current = false;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (cleared.current) return;
        void (next ? longText.set(key, next) : longText.remove(key));
      }, 400);
    },
    [key],
  );

  /** Fill the field from the server's copy without treating it as something the user typed. */
  const seed = useCallback((next: string) => setValue(next), []);

  const clear = useCallback(async () => {
    cleared.current = true;
    if (timer.current) clearTimeout(timer.current);
    setRestored(false);
    if (key !== null) await longText.remove(key);
  }, [key]);

  // Don't lose the last few keystrokes if the screen closes before the timer fires.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { value, setValue: change, seed, clear, ready, restored };
}
