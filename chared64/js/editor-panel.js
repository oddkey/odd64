import { bindTap, touchUsesTap } from "./gesture.js";
import { fitZoom, glyphOffset, pushGlyphUndo, sameBytes, setPixel } from "./project.js";
import { contentBoxWidth, drawGlyph, prepareCanvas } from "./render.js";

export function mountEditor(session) {
  const canvas = document.getElementById("editor-canvas");
  const preview = document.getElementById("preview-canvas");
  let stroke = null;

  function pixelAt(event) {
    const rect = canvas.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    if (rect.width <= 0 || rect.height <= 0) return { x: -1, y: -1 };
    if (session.project.mode === "single") {
      return {
        x: Math.floor(px / (rect.width / 8)),
        y: Math.floor(py / (rect.height / 8)),
      };
    }
    return {
      x: Math.floor(px / (rect.width / 4)),
      y: Math.floor(py / (rect.height / 8)),
    };
  }

  function paintValue(button) {
    const { project, ui } = session;
    if (button === 2) return 0;
    if (project.mode === "single") return ui.paintRole === "background" ? 0 : 1;
    if (ui.paintRole === "background") return 0;
    if (ui.paintRole === "multi1") return 1;
    if (ui.paintRole === "multi2") return 2;
    return 3;
  }

  function apply(x, y, value) {
    const project = session.project;
    const offset = glyphOffset(stroke.set, stroke.index);
    const bytes = project.characters.subarray(offset, offset + 8);
    return setPixel(bytes, project.mode, x, y, value);
  }

  function beginStroke(event) {
    const project = session.project;
    const offset = glyphOffset(project.activeSet, project.selected);
    stroke = {
      set: project.activeSet,
      index: project.selected,
      before: project.characters.slice(offset, offset + 8),
      value: paintValue(event.button),
    };
    session.ui.lastSurface = "editor";
    const point = pixelAt(event);
    apply(point.x, point.y, stroke.value);
    session.emit("pixels-live");
  }

  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.button !== 2) return;
    if (touchUsesTap(event, { draws: true })) return;
    event.preventDefault();
    beginStroke(event);
    try { canvas.setPointerCapture(event.pointerId); } catch { /* pointer already gone */ }
  });
  bindTap(canvas, {
    enabled: (event) => touchUsesTap(event, { draws: true }),
    onTap: (event) => {
      beginStroke(event);
      endStroke(true);
    },
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!stroke) return;
    const point = pixelAt(event);
    if (apply(point.x, point.y, stroke.value)) session.emit("pixels-live");
  });

  function endStroke(commit) {
    if (!stroke) return;
    const project = session.project;
    const offset = glyphOffset(stroke.set, stroke.index);
    if (!commit) project.characters.set(stroke.before, offset);
    else {
      const after = project.characters.subarray(offset, offset + 8);
      if (!sameBytes(stroke.before, after)) {
        pushGlyphUndo(project, { set: stroke.set, index: stroke.index, bytes: stroke.before });
        session.ui.dirty = true;
      }
    }
    stroke = null;
    session.emit(commit ? "pixels" : "view");
  }

  canvas.addEventListener("pointerup", () => endStroke(true));
  canvas.addEventListener("pointercancel", () => endStroke(false));

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && stroke) endStroke(false);
  });

  return {
    draw() {
      const project = session.project;
      const zoom = editorZoom(session, canvas);
      const size = 8 * zoom;
      const ctx = prepareCanvas(canvas, size, size);
      const offset = glyphOffset(project.activeSet, project.selected);
      const bytes = project.characters.subarray(offset, offset + 8);
      const ink = project.mode === "multi" ? project.colors.multiCell : project.colors.foreground;
      ctx.clearRect(0, 0, size, size);
      drawGlyph(ctx, bytes, 0, 0, zoom, project.mode, project.colors, ink);
      drawGrid(ctx, zoom, project.mode);

      const previewCtx = prepareCanvas(preview, 64, 64);
      previewCtx.clearRect(0, 0, 64, 64);
      drawGlyph(previewCtx, bytes, 0, 0, 8, project.mode, project.colors, ink);
    },
  };
}

function editorZoom(session, canvas) {
  if (!session.ui.fitEditor) return session.project.zoom.editor;
  const fitted = fitZoom(contentBoxWidth(canvas.parentElement), 8, window.devicePixelRatio || 1);
  return fitted || session.project.zoom.editor;
}

function drawGrid(ctx, zoom, mode) {
  ctx.save();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  const verticalStep = mode === "multi" ? zoom * 2 : zoom;
  for (let x = verticalStep; x < zoom * 8; x += verticalStep) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, zoom * 8);
  }
  for (let y = zoom; y < zoom * 8; y += zoom) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(zoom * 8, y + 0.5);
  }
  ctx.stroke();
  ctx.restore();
}
