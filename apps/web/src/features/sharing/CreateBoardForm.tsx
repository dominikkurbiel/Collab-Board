"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useTRPC } from "@/trpc/client";
import { CopyLinkButton } from "./CopyLinkButton";
import styles from "./sharing.module.css";

const MIN_PASSWORD_LENGTH = 4;

/** Creates a new board (optionally password-protected) and shows its link to share. */
export function CreateBoardForm() {
  const trpc = useTRPC();
  const createBoard = useMutation(trpc.boards.create.mutationOptions());
  const [protect, setProtect] = useState(false);
  const [password, setPassword] = useState("");

  if (createBoard.data) {
    const path = `/board/${createBoard.data.id}`;
    const url = `${window.location.origin}${path}`;

    return (
      <section className={styles.card} aria-live="polite">
        <h2>Your board is ready</h2>
        <p>
          Share this link
          {createBoard.data.hasPassword
            ? " and the password: people need both to open the board."
            : ": anyone with it can open and edit the board."}
        </p>
        <div className={styles.linkRow}>
          <input className={styles.input} value={url} readOnly onFocus={(e) => e.target.select()} />
          <CopyLinkButton url={url} />
        </div>
        <div className={styles.actions}>
          <Link className={`${styles.button} ${styles.primary}`} href={path}>
            Open board →
          </Link>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => {
              createBoard.reset();
              setPassword("");
            }}
          >
            Create another
          </button>
        </div>
      </section>
    );
  }

  return (
    <form
      className={styles.card}
      onSubmit={(event) => {
        event.preventDefault();
        createBoard.mutate({ password: protect ? password : undefined });
      }}
    >
      <h2>Create a board</h2>

      <label className={styles.checkbox}>
        <input type="checkbox" checked={protect} onChange={(e) => setProtect(e.target.checked)} />
        Protect with a password
      </label>

      {protect && (
        <input
          className={styles.input}
          type="password"
          placeholder={`Password (at least ${MIN_PASSWORD_LENGTH} characters)`}
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          maxLength={128}
          required
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      )}

      <div className={styles.actions}>
        <button
          type="submit"
          className={`${styles.button} ${styles.primary}`}
          disabled={createBoard.isPending}
        >
          {createBoard.isPending ? "Creating…" : "Create board"}
        </button>
      </div>

      {createBoard.isError && (
        <p className={styles.error} role="alert">
          Could not create the board. Is the server running?
        </p>
      )}
    </form>
  );
}
