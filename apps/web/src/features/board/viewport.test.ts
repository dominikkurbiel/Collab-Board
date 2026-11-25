import { describe, expect, it } from "vitest";
import {
  INITIAL_VIEWPORT,
  MAX_ZOOM,
  MIN_ZOOM,
  centeredRect,
  clampZoom,
  fitToContent,
  getBounds,
  panBy,
  rectFromPoints,
  screenToWorld,
  worldToScreen,
  zoomAt,
  type Viewport,
} from "./viewport";

const viewport: Viewport = { x: -5000, y: 300, zoom: 0.5 };

describe("screenToWorld / worldToScreen", () => {
  it("converts a screen point to world coordinates", () => {
    expect(screenToWorld(viewport, { x: 400, y: 500 })).toEqual({ x: 10800, y: 400 });
  });

  it("are inverse of each other", () => {
    const world = { x: 1234.5, y: -987 };
    const roundTrip = screenToWorld(viewport, worldToScreen(viewport, world));
    expect(roundTrip.x).toBeCloseTo(world.x);
    expect(roundTrip.y).toBeCloseTo(world.y);
  });
});

describe("clampZoom", () => {
  it("keeps zoom within limits", () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM);
    expect(clampZoom(100)).toBe(MAX_ZOOM);
    expect(clampZoom(1.5)).toBe(1.5);
  });
});

describe("panBy", () => {
  it("moves the offset without changing zoom", () => {
    expect(panBy(viewport, 10, -20)).toEqual({ x: -4990, y: 280, zoom: 0.5 });
  });
});

describe("zoomAt", () => {
  it("keeps the world point under the cursor in place", () => {
    const cursor = { x: 320, y: 240 };
    const before = screenToWorld(viewport, cursor);
    const zoomed = zoomAt(viewport, cursor, 2);
    const after = screenToWorld(zoomed, cursor);

    expect(zoomed.zoom).toBe(1);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("respects the zoom limits", () => {
    expect(zoomAt(INITIAL_VIEWPORT, { x: 0, y: 0 }, 1000).zoom).toBe(MAX_ZOOM);
    expect(zoomAt(INITIAL_VIEWPORT, { x: 0, y: 0 }, 0.0001).zoom).toBe(MIN_ZOOM);
  });
});

describe("rectFromPoints", () => {
  it("works when dragging up-left", () => {
    expect(rectFromPoints({ x: 100, y: 80 }, { x: 20, y: 10 })).toEqual({
      x: 20,
      y: 10,
      width: 80,
      height: 70,
    });
  });
});

describe("centeredRect", () => {
  it("centers the rectangle on the point", () => {
    expect(centeredRect({ x: 0, y: 0 }, { width: 200, height: 100 })).toEqual({
      x: -100,
      y: -50,
      width: 200,
      height: 100,
    });
  });
});

describe("getBounds", () => {
  it("returns null for no rectangles", () => {
    expect(getBounds([])).toBeNull();
  });

  it("encloses all rectangles", () => {
    const bounds = getBounds([
      { x: 0, y: 0, width: 100, height: 100 },
      { x: -50, y: 200, width: 10, height: 50 },
    ]);
    expect(bounds).toEqual({ x: -50, y: 0, width: 150, height: 250 });
  });
});

describe("fitToContent", () => {
  const screen = { width: 1000, height: 800 };

  it("returns the initial viewport when the board is empty", () => {
    expect(fitToContent([], screen)).toEqual(INITIAL_VIEWPORT);
  });

  it("centers small content without zooming in past 100%", () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 };
    const result = fitToContent([rect], screen);

    expect(result.zoom).toBe(1);
    expect(worldToScreen(result, { x: 50, y: 50 })).toEqual({ x: 500, y: 400 });
  });

  it("zooms out so far-apart content fits on screen", () => {
    const rects = [
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 4000, y: 0, width: 100, height: 100 },
    ];
    const padding = 80;
    const result = fitToContent(rects, screen, padding);

    const left = worldToScreen(result, { x: 0, y: 0 });
    const right = worldToScreen(result, { x: 4100, y: 100 });
    expect(left.x).toBeCloseTo(padding);
    expect(right.x).toBeCloseTo(screen.width - padding);
  });

  it("stops at MIN_ZOOM for huge content but keeps it centered", () => {
    const rects = [
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 20000, y: 0, width: 100, height: 100 },
    ];
    const result = fitToContent(rects, screen);

    expect(result.zoom).toBe(MIN_ZOOM);
    expect(worldToScreen(result, { x: 10050, y: 50 })).toEqual({ x: 500, y: 400 });
  });
});
