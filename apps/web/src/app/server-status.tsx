"use client";

import { useEffect, useState } from "react";
import type { HealthResponse } from "@collab-board/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Status = "checking" | "online" | "offline";

export function ServerStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_URL}/health`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<HealthResponse>) : Promise.reject()))
      .then((data) => setStatus(data.status === "ok" ? "online" : "offline"))
      .catch(() => {
        if (!controller.signal.aborted) setStatus("offline");
      });

    return () => controller.abort();
  }, []);

  return (
    <p className={`status status--${status}`}>
      API: <strong>{status}</strong>
    </p>
  );
}
