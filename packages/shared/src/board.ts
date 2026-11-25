export const NOTE_COLORS = ["yellow", "pink", "blue", "green", "purple"] as const;

export type NoteColor = (typeof NOTE_COLORS)[number];

export const DEFAULT_NOTE_SIZE = 200;

/**
 * A sticky note on the board. `x` / `y` are WORLD coordinates of the top-left corner:
 * they never change when someone pans or zooms their view.
 */
export interface BoardNote {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: NoteColor;
}
