"use client";

import { useEffect, useState } from "react";

/** True when print media is active (e.g. print preview or PDF export). */
export function usePrintMode(): boolean {
  const [isPrint, setIsPrint] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("print");
    const handler = () => setIsPrint(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isPrint;
}
