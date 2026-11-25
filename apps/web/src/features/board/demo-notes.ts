import { DEFAULT_NOTE_SIZE, type BoardNote } from "@collab-board/shared";

const note = (id: string, x: number, y: number, text: string, color: BoardNote["color"]) => ({
  id,
  x,
  y,
  width: DEFAULT_NOTE_SIZE,
  height: DEFAULT_NOTE_SIZE,
  text,
  color,
});

/** Starting content, so the demo board isn't empty. Fixed ids keep SSR and client in sync. */
export const DEMO_NOTES: BoardNote[] = [
  note("demo-1", 120, 140, "Welcome to Collab Board 👋", "yellow"),
  note("demo-2", 380, 180, "Drag me around", "pink"),
  note("demo-3", 640, 120, "Double-click the board to add a note", "blue"),
  note("demo-4", 260, 440, "Scroll to pan, ⌘/Ctrl + scroll to zoom", "green"),
];
