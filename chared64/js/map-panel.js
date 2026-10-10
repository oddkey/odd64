import { bindTap, touchUsesTap } from "./gesture.js";
import { cellCol, cellRow, fitZoom, selectionRect } from "./project.js";
import { contentBoxWidth, drawGlyph, prepareCanvas } from "./render.js";

const HOVER_SCALE = 2.5;

export function mountMap(session) {
  const canvas = document.getElementById("map-canvas");
  let hover = null;

  function cellAt(event) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const col = Math.floor((event.clientX - rect.left) / (rect.width / 16));
    const row = Math.floor((event.clientY - rect.top) / (rect.height / 16));
    if (col < 0 || row < 0 || col > 15 || row > 15) return null;
    return row * 16 + col;
  }

  function selectAt(event) {
    const index = cellAt(event);
    if (index === null) return;
    session.select(index, { extend: event.shiftKey });
  }

  function setHover(index) {
    if (index === hover) return;
    hover = index;
    draw();
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || touchUsesTap(event)) return;
    selectAt(event);
  });
  bindTap(canvas, { enabled: touchUsesTap, onTap: selectAt });
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    setHover(cellAt(event));
  });
  canvas.addEventListener("pointerleave", () => setHover(null));

  function draw() {
    const project = session.project;
    const zoom = mapZoom(session, canvas);
    const cell = 8 * zoom;
    const ctx = prepareCanvas(canvas, cell * 16, cell * 16);
    ctx.clearRect(0, 0, cell * 16, cell * 16);
    const ink = project.mode === "multi" ? project.colors.multiCell : project.colors.foreground;
    const base = project.activeSet === "lower" ? 2048 : 0;
    for (let index = 0; index < 256; index += 1) {
      const bytes = project.characters.subarray(base + index * 8, base + index * 8 + 8);
      const x = (index % 16) * cell;
      const y = Math.floor(index / 16) * cell;
      drawGlyph(ctx, bytes, x, y, zoom, project.mode, project.colors, ink);
    }
    const selected = selectionRect(project);
    if (selected.width > 1 || selected.height > 1) {
      fillCells(ctx, selected, cell, "rgba(142, 176, 255, 0.22)");
      strokeCells(ctx, selected, cell, "#8eb0ff", 0);
    }
    strokeCell(ctx, cellCol(project.selected) * cell, cellRow(project.selected) * cell, cell, "#8eb0ff", 0);
    if (project.copyFrom && project.copyFrom.set === project.activeSet) {
      const copied = {
        col: cellCol(project.copyFrom.index),
        row: cellRow(project.copyFrom.index),
        width: project.copyFrom.width ?? 1,
        height: project.copyFrom.height ?? 1,
      };
      const same =
        copied.col === selected.col &&
        copied.row === selected.row &&
        copied.width === selected.width &&
        copied.height === selected.height;
      if (copied.width > 1 || copied.height > 1) {
        fillCells(ctx, copied, cell, "rgba(224, 164, 90, 0.2)");
        strokeCells(ctx, copied, cell, "#e0a45a", same ? 3 : 0);
      } else {
        strokeCell(ctx, copied.col * cell, copied.row * cell, cell, "#e0a45a", same ? 3 : 0);
      }
    }
    if (hover !== null) drawHover(ctx, project, base, ink, cell, hover);
  }

  return { draw };
}

function drawHover(ctx, project, base, ink, cell, index) {
  const span = cell * 16;
  const big = cell * HOVER_SCALE;
  const hx = (index % 16) * cell;
  const hy = Math.floor(index / 16) * cell;
  const x = clamp(hx + cell / 2 - big / 2, 0, span - big);
  const y = clamp(hy + cell / 2 - big / 2, 0, span - big);
  ctx.save();
  ctx.fillStyle = "#10141a";
  ctx.fillRect(x - 3, y - 3, big + 6, big + 6);
  ctx.restore();
  const bytes = project.characters.subarray(base + index * 8, base + index * 8 + 8);
  drawGlyph(ctx, bytes, x, y, big / 8, project.mode, project.colors, ink);
  strokeCell(ctx, x, y, big, "#f2f5fb", 0);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mapZoom(session, canvas) {
  if (!session.ui.fitCharacters) return session.project.zoom.characters;
  const fitted = fitZoom(contentBoxWidth(canvas.parentElement), 128, window.devicePixelRatio || 1);
  return fitted || session.project.zoom.characters;
}

function strokeCell(ctx, x, y, cell, color, inset) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, Math.min(3, cell / 8));
  const pad = inset + 0.5;
  ctx.strokeRect(x + pad, y + pad, cell - inset * 2 - 1, cell - inset * 2 - 1);
  ctx.restore();
}

function fillCells(ctx, rect, cell, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(rect.col * cell, rect.row * cell, rect.width * cell, rect.height * cell);
  ctx.restore();
}

function strokeCells(ctx, rect, cell, color, inset) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, Math.min(3, cell / 8));
  const pad = inset + 0.5;
  ctx.strokeRect(
    rect.col * cell + pad,
    rect.row * cell + pad,
    rect.width * cell - inset * 2 - 1,
    rect.height * cell - inset * 2 - 1,
  );
  ctx.restore();
}
