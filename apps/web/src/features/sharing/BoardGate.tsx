"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Board } from "@/features/board/components/Board";
import { useTRPC } from "@/trpc/client";
import styles from "./sharing.module.css";

/**
 * Decides what the visitor of /board/<id> sees: the board, a password form, or
 * "not found". The server enforces the same rule on the WebSocket, so this is only UX:
 * skipping it in the browser doesn't give access.
 */
export function BoardGate({ boardId }: { boardId: string }) {
  const trpc = useTRPC();
  const access = useQuery(trpc.boards.access.queryOptions({ boardId }));

  if (access.isPending) {
    return <Message>Loading board…</Message>;
  }
  if (access.isError) {
    return (
      <Message>
        <p>Could not load the board. Is the server running?</p>
        <button type="button" className={styles.button} onClick={() => access.refetch()}>
          Try again
        </button>
      </Message>
    );
  }

  switch (access.data.access) {
    case "granted":
      return <Board boardId={boardId} />;
    case "password-required":
      return <PasswordForm boardId={boardId} />;
    case "not-found":
      return (
        <Message>
          <h1>Board not found</h1>
          <p>The link may be wrong, or the board was deleted.</p>
          <Link className={`${styles.button} ${styles.primary}`} href="/">
            Create a new board
          </Link>
        </Message>
      );
  }
}

function PasswordForm({ boardId }: { boardId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");

  const unlock = useMutation(
    trpc.boards.unlock.mutationOptions({
      // The server set the access cookie: ask again, and the board opens
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: trpc.boards.access.queryKey({ boardId }) }),
    }),
  );

  return (
    <Message>
      <form
        className={styles.card}
        onSubmit={(event) => {
          event.preventDefault();
          unlock.mutate({ boardId, password });
        }}
      >
        <h1>This board is password-protected</h1>
        <input
          className={styles.input}
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          required
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className={styles.actions}>
          <button
            type="submit"
            className={`${styles.button} ${styles.primary}`}
            disabled={unlock.isPending}
          >
            {unlock.isPending ? "Checking…" : "Open board"}
          </button>
        </div>
        {unlock.isError && (
          <p className={styles.error} role="alert">
            {/* The server's messages are written for users ("Wrong password", "Try again in 60 s") */}
            {unlock.error.data?.code ? unlock.error.message : "Something went wrong, try again."}
          </p>
        )}
      </form>
    </Message>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return <main className={styles.message}>{children}</main>;
}
