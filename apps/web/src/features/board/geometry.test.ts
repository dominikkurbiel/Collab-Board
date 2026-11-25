import type { BoardElement } from "@collab-board/shared";
import { describe, expect, it } from "vitest";
import {
  boundaryPoint,
  connectorEndpoints,
  containsPoint,
  elementAt,
  rectCenter,
} from "./geometry";

function element(id: string, overrides: Partial<BoardElement> = {}): BoardElement {
  return {
    id,
    type: "rectangle",
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    text: "",
    color: "blue",
    ...overrides,
  };
}

// Center (100, 50), half-size 100 × 50
const rect = element("rect");
const ellipse = element("ellipse", { type: "ellipse" });

describe("rectCenter", () => {
  it("returns the middle of the rectangle", () => {
    expect(rectCenter(rect)).toEqual({ x: 100, y: 50 });
  });
});

describe("containsPoint", () => {
  it("uses the bounding box for rectangles", () => {
    expect(containsPoint(rect, { x: 2, y: 2 })).toBe(true);
    expect(containsPoint(rect, { x: 201, y: 50 })).toBe(false);
  });

  it("ignores the corners of an ellipse", () => {
    expect(containsPoint(ellipse, { x: 100, y: 50 })).toBe(true);
    expect(containsPoint(ellipse, { x: 2, y: 2 })).toBe(false);
  });
});

describe("elementAt", () => {
  it("returns the topmost element under the point", () => {
    const bottom = element("bottom");
    const top = element("top", { x: 50 });
    expect(elementAt([bottom, top], { x: 60, y: 10 })?.id).toBe("top");
    expect(elementAt([bottom, top], { x: 10, y: 10 })?.id).toBe("bottom");
  });

  it("returns null on empty space", () => {
    expect(elementAt([rect], { x: 500, y: 500 })).toBeNull();
  });
});

describe("boundaryPoint", () => {
  it("hits the side of a rectangle", () => {
    expect(boundaryPoint(rect, { x: 1000, y: 50 })).toEqual({ x: 200, y: 50 });
    expect(boundaryPoint(rect, { x: 100, y: -1000 })).toEqual({ x: 100, y: 0 });
  });

  it("hits the corner of a rectangle on its diagonal", () => {
    expect(boundaryPoint(rect, { x: 300, y: 150 })).toEqual({ x: 200, y: 100 });
  });

  it("lands exactly on the ellipse outline", () => {
    const point = boundaryPoint(ellipse, { x: 400, y: 400 });
    const nx = (point.x - 100) / 100;
    const ny = (point.y - 50) / 50;
    expect(nx * nx + ny * ny).toBeCloseTo(1);
  });

  it("returns the center when the target is the center", () => {
    expect(boundaryPoint(rect, { x: 100, y: 50 })).toEqual({ x: 100, y: 50 });
  });
});

describe("connectorEndpoints", () => {
  it("connects the facing edges of two elements", () => {
    const right = element("right", { x: 400 });
    expect(connectorEndpoints(rect, right)).toEqual({
      start: { x: 200, y: 50 },
      end: { x: 400, y: 50 },
    });
  });
});
