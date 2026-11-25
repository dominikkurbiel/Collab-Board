import { beforeEach, describe, expect, it } from "vitest";
import { useBoardUi } from "./ui-store";
import { INITIAL_VIEWPORT } from "./viewport";

// A Zustand store works without React: getState() / setState() are enough for tests
const initialState = useBoardUi.getState();

beforeEach(() => {
  useBoardUi.setState(initialState, true);
});

describe("useBoardUi", () => {
  it("starts with the select tool, initial viewport and no selection", () => {
    const { tool, viewport, selectedId } = useBoardUi.getState();
    expect(tool).toBe("select");
    expect(viewport).toEqual(INITIAL_VIEWPORT);
    expect(selectedId).toBeNull();
  });

  it("changes tool and selection", () => {
    useBoardUi.getState().setTool("ellipse");
    useBoardUi.getState().select("element-1");
    expect(useBoardUi.getState()).toMatchObject({ tool: "ellipse", selectedId: "element-1" });
  });

  it("accepts a viewport value or an updater function", () => {
    const { setViewport } = useBoardUi.getState();

    setViewport({ x: 10, y: 20, zoom: 2 });
    setViewport((v) => ({ ...v, x: v.x + 5 }));

    expect(useBoardUi.getState().viewport).toEqual({ x: 15, y: 20, zoom: 2 });
  });
});
