"use client";

import { NOTE_COLORS, type NoteColor } from "@collab-board/shared";
import { useEffect, useState } from "react";
import styles from "../board.module.css";

interface ToolbarProps {
  zoom: number;
  selectedId: string | null;
  selectedColor: NoteColor | null;
  onAddNote: () => void;
  onColorChange: (color: NoteColor) => void;
  onDeleteSelected: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onZoomToFit: () => void;
}

export function Toolbar({
  zoom,
  selectedId,
  selectedColor,
  onAddNote,
  onColorChange,
  onDeleteSelected,
  onZoomIn,
  onZoomOut,
  onResetView,
  onZoomToFit,
}: ToolbarProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const hasSelection = selectedId !== null;

  // Selecting another note (or none) cancels a pending delete confirmation
  useEffect(() => {
    setConfirmingDelete(false);
  }, [selectedId]);

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Board tools">
      <button type="button" onClick={onAddNote}>
        + Add note
      </button>

      <div className={styles.colors} aria-label="Note color">
        {NOTE_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`${styles.swatch} ${styles[color]} ${
              selectedColor === color ? styles.swatchActive : ""
            }`}
            disabled={!hasSelection}
            onClick={() => onColorChange(color)}
            aria-label={`Color: ${color}`}
            title={hasSelection ? color : "Select a note first"}
          />
        ))}
      </div>

      {confirmingDelete ? (
        <div className={styles.confirm}>
          <span>Delete note?</span>
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
          title={hasSelection ? "Delete selected note" : "Select a note first"}
        >
          Delete
        </button>
      )}

      <div className={styles.zoom}>
        <button type="button" onClick={onZoomOut} aria-label="Zoom out">
          −
        </button>
        <span className={styles.zoomValue}>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={onZoomIn} aria-label="Zoom in">
          +
        </button>
      </div>

      <button type="button" onClick={onZoomToFit}>
        Zoom to fit
      </button>
      <button type="button" onClick={onResetView}>
        Reset view
      </button>
    </div>
  );
}
