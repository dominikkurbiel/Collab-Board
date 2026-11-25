import { DEFAULT_NOTE_SIZE, type BoardNote, type NoteColor } from "@collab-board/shared";
import type { Point } from "./viewport";

/**
 * Board state and all the ways it can change. Pure functions, no React:
 * when real-time sync (Yjs) arrives, only the source of this state changes.
 */

export interface BoardState {
  /** Render order: the last note is drawn on top. */
  notes: BoardNote[];
  selectedId: string | null;
}

export type BoardAction =
  | { type: "addNote"; note: BoardNote }
  | { type: "moveNote"; id: string; x: number; y: number }
  | { type: "updateNoteText"; id: string; text: string }
  | { type: "setNoteColor"; id: string; color: NoteColor }
  | { type: "deleteNote"; id: string }
  | { type: "selectNote"; id: string | null };

export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case "addNote":
      return { notes: [...state.notes, action.note], selectedId: action.note.id };

    case "moveNote":
      return updateNote(state, action.id, { x: action.x, y: action.y });

    case "updateNoteText":
      return updateNote(state, action.id, { text: action.text });

    case "setNoteColor":
      return updateNote(state, action.id, { color: action.color });

    case "deleteNote":
      return {
        notes: state.notes.filter((note) => note.id !== action.id),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      };

    case "selectNote": {
      if (action.id === null) return { ...state, selectedId: null };
      // Bring the selected note to the front
      const note = state.notes.find((n) => n.id === action.id);
      if (!note) return state;
      return {
        notes: [...state.notes.filter((n) => n.id !== action.id), note],
        selectedId: action.id,
      };
    }
  }
}

function updateNote(state: BoardState, id: string, changes: Partial<BoardNote>): BoardState {
  return {
    ...state,
    notes: state.notes.map((note) => (note.id === id ? { ...note, ...changes } : note)),
  };
}

/** New note centered on a world position. */
export function createNote(center: Point, color: NoteColor = "yellow"): BoardNote {
  return {
    id: crypto.randomUUID(),
    x: center.x - DEFAULT_NOTE_SIZE / 2,
    y: center.y - DEFAULT_NOTE_SIZE / 2,
    width: DEFAULT_NOTE_SIZE,
    height: DEFAULT_NOTE_SIZE,
    text: "",
    color,
  };
}
