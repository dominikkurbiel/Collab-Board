"use client";

import styles from "../board.module.css";
import { useRemoteUsers, type Awareness } from "../use-presence";
import { useBoardUi } from "../ui-store";
import { worldToScreen } from "../viewport";

/**
 * Other people's cursors, drawn in SCREEN space (like the selection handles), so they
 * keep the same size at any zoom. Positions arrive in world coordinates and are mapped
 * through OUR viewport: the cursor points at the same spot on the board as for its owner.
 */
export function RemoteCursors({ awareness }: { awareness: Awareness | null }) {
  // Subscribing here (not in Board) means a moving cursor re-renders only this component
  const users = useRemoteUsers(awareness);
  const viewport = useBoardUi((s) => s.viewport);

  return (
    <div className={styles.cursors} aria-hidden>
      {users.map(({ clientId, user, cursor }) => {
        if (!cursor) return null;
        const point = worldToScreen(viewport, cursor);
        return (
          <div
            key={clientId}
            className={styles.cursor}
            style={
              {
                transform: `translate(${point.x}px, ${point.y}px)`,
                "--cursor-color": user.color,
              } as React.CSSProperties
            }
          >
            <svg className={styles.cursorIcon} width="18" height="18" viewBox="0 0 18 18">
              <path d="M2 2 L16 8.5 L9.5 10 L7 16.5 Z" />
            </svg>
            <span className={styles.cursorLabel}>{user.name}</span>
          </div>
        );
      })}
    </div>
  );
}
