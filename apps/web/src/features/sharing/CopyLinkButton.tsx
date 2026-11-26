"use client";

import { useEffect, useState } from "react";
import styles from "./sharing.module.css";

/** Copies a link to the clipboard and briefly confirms it. Defaults to the current page. */
export function CopyLinkButton({ url, label = "Copy link" }: { url?: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2_000);
    return () => clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    try {
      // The Clipboard API only works on HTTPS or localhost
      await navigator.clipboard.writeText(url ?? window.location.href);
      setState("copied");
    } catch {
      setState("failed");
    }
  };

  return (
    <button type="button" className={styles.button} onClick={copy}>
      {state === "copied" ? "Copied ✓" : state === "failed" ? "Copy failed" : label}
    </button>
  );
}
