"use client";

import { useEffect, useRef, useCallback } from "react";

interface Props {
  onIntersect: () => void;
  /** Pass the scroll container element when the list scrolls inside a bounded div.
   *  Leave undefined for page-level scroll. */
  root?: Element | null;
}

export default function ScrollSentinel({ onIntersect, root }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const cb = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting) onIntersect();
    },
    [onIntersect]
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(cb, {
      root: root ?? null,
      threshold: 0.1,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [cb, root]);

  return <div ref={ref} style={{ height: 4 }} />;
}
