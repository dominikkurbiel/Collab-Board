"use client";

import { ELEMENT_COLORS, type ElementColor } from "@collab-board/shared";
import { useEffect, useState } from "react";
import styles from "../board.module.css";
import { useBoardUi, type Tool } from "../ui-store";

const TOOLS: { tool: Tool; label: string; shortcut: string }[] = [
  { tool: "select", label: "Select", shortcut: "V" },
  { tool: "note", label: "Note", shortcut: "N" },
  { tool: "rectangle", label: "Rectangle", shortcut: "R" },
  { tool: "ellipse", label: "Ellipse", shortcut: "O" },
  { tool: "connector", label: "Arrow", shortcut: "A" },
];

interface ToolbarProps {
  selectedColor: ElementColor | null;
  onColorChange: (color: ElementColor) => void;
  onDeleteSelected: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onZoomToFit: () => void;
}

export function Toolbar({
  selectedColor,
  onColorChange,
  onDeleteSelected,
  onZoomIn,
  onZoomOut,
  onResetView,
  onZoomToFit,
}: ToolbarProps) {
  // Read straight from the Zustand store: no need to pass these through Board as props
  const tool = useBoardUi((state) => state.tool);
  const setTool = useBoardUi((state) => state.setTool);
  const zoom = useBoardUi((state) => state.viewport.zoom);
  const selectedId = useBoardUi((state) => state.selectedId);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const hasSelection = selectedId !== null;
  // Arrows have no color (yet), so the swatches need a selected element, not just a selection
  const canChangeColor = selectedColor !== null;

  // Selecting another element (or none) cancels a pending delete confirmation
  useEffect(() => {
    setConfirmingDelete(false);
  }, [selectedId]);

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Board tools">
      <div className={styles.group} role="radiogroup" aria-label="Tool">
        {TOOLS.map(({ tool: t, label, shortcut }) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={tool === t}
            className={tool === t ? styles.active : ""}
            onClick={() => setTool(t)}
            title={`${label} (${shortcut})`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.group} aria-label="Color">
        {ELEMENT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`${styles.swatch} ${styles[color]} ${
              selectedColor === color ? styles.swatchActive : ""
            }`}
            disabled={!canChangeColor}
            onClick={() => onColorChange(color)}
            aria-label={`Color: ${color}`}
            title={canChangeColor ? color : "Select an element first"}
          />
        ))}
      </div>

      {confirmingDelete ? (
        <div className={styles.group}>
          <span>Delete?</span>
          <button
            type="button"
            className={styles.dangerButton}
            onClick={() => {
              onDeleteSelected();
              setConfirmingDelete(false);
            }}
          >
            Yes
          </button>
          <button type="button" onClick={() => setConfirmingDelete(false)}>
            No
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!hasSelection}
          onClick={() => setConfirmingDelete(true)}
          title={hasSelection ? "Delete selected element" : "Select an element first"}
        >
          Delete
        </button>
      )}

      <div className={styles.group}>
        <button type="button" onClick={onZoomOut} aria-label="Zoom out">
          −
        </button>
        <span className={styles.zoomValue}>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={onZoomIn} aria-label="Zoom in">
          +
        </button>
      </div>

      <button type="button" onClick={onZoomToFit}>
        Fit
      </button>
      <button type="button" onClick={onResetView}>
        Reset
      </button>
    </div>
  );
}
