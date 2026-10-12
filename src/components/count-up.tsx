"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(MOTION_QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(MOTION_QUERY).matches,
    () => false,
  );
}

/**
 * Animates a number from 0 to `target` with an ease-out curve. Users who
 * prefer reduced motion get the final value immediately.
 */
export function useCountUp(target: number, duration = 1300, delay = 0): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now + delay;
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, delay, reduced]);

  return reduced ? target : value;
}

export function CountUp({ value, duration, delay }: { value: number; duration?: number; delay?: number }) {
  const v = useCountUp(value, duration, delay);
  return (
    <>
      <span aria-hidden="true">{Math.round(v)}</span>
      <span className="sr-only">{value}</span>
    </>
  );
}
