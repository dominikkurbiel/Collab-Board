import type { ElementType } from "@collab-board/shared";
import { create } from "zustand";
import { INITIAL_VIEWPORT, type Viewport } from "./viewport";

export type Tool = "select" | ElementType;

/**
 * Per-user UI state, kept OUT of the board document on purpose:
 * my zoom, my selected tool and my selection must not be synced to other people.
 */
interface BoardUiState {
  tool: Tool;
  viewport: Viewport;
  selectedId: string | null;
  setTool: (tool: Tool) => void;
  setViewport: (update: Viewport | ((current: Viewport) => Viewport)) => void;
  select: (id: string | null) => void;
}

export const useBoardUi = create<BoardUiState>()((set) => ({
  tool: "select",
  viewport: INITIAL_VIEWPORT,
  selectedId: null,
  setTool: (tool) => set({ tool }),
  setViewport: (update) =>
    set((state) => ({
      viewport: typeof update === "function" ? update(state.viewport) : update,
    })),
  select: (selectedId) => set({ selectedId }),
}));
