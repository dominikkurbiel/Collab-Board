"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function ServerStatus() {
  const trpc = useTRPC();

  const health = useQuery(trpc.health.check.queryOptions(undefined, { refetchInterval: 10_000 }));
  const hello = useQuery(trpc.health.hello.queryOptions({ name: "visitor" }));

  const status = health.isPending ? "checking" : health.isError ? "offline" : "online";

  return (
    <>
      <p className={`status status--${status}`}>
        API: <strong>{status}</strong>
      </p>
      {hello.data && <p>{hello.data.greeting}</p>}
    </>
  );
}
