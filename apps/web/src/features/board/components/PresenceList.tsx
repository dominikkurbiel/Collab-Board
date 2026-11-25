"use client";

import styles from "../board.module.css";
import { useRemoteUsers, type Awareness } from "../use-presence";

const MAX_VISIBLE = 4;

function initials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Avatars of everyone else on the board ("who's here"). */
export function PresenceList({ awareness }: { awareness: Awareness | null }) {
  // Subscribing here (not in Board) means a moving cursor re-renders only this component
  const users = useRemoteUsers(awareness);
  if (users.length === 0) return null;

  const visible = users.slice(0, MAX_VISIBLE);
  const hidden = users.length - visible.length;

  return (
    <ul className={styles.presence} aria-label={`${users.length} other people on this board`}>
      {visible.map(({ clientId, user }) => (
        <li
          key={clientId}
          className={styles.avatar}
          style={{ background: user.color }}
          title={user.name}
        >
          {initials(user.name)}
        </li>
      ))}
      {hidden > 0 && <li className={`${styles.avatar} ${styles.avatarMore}`}>+{hidden}</li>}
    </ul>
  );
}
