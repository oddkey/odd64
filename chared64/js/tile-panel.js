import { bindTap, touchUsesTap } from "./gesture.js";
import { eachStampCell, pushTileUndo, selectionRect, tileRectFromCorners, undoTile } from "./project.js";
import { displayInk, drawGlyph, prepareCanvas } from "./render.js";

export function mountTiles(session) {
  const frame = document.getElementById("tile-frame");
  const scroller = document.getElementById("tile-scroll");
  const spacer = document.getElementById("tile-spacer");
  const canvas = document.getElementById("tile-canvas");
  const overlay = document.getElementById("tile-overlay");
  let stroke = null;

  function cellSize() {
    return 8 * session.project.zoom.tiles;
  }

  function cellAt(event) {
    const rect = scroller.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < 0 || y < 0 || x >= scroller.clientWidth || y >= scroller.clientHeight) return null;
    const size = cellSize();
    return {
      x: Math.floor((x + scroller.scrollLeft) / size),
      y: Math.floor((y + scroller.scrollTop) / size),
    };
  }

  function inBounds(project, point) {
    return point && point.x >= 0 && point.y >= 0 && point.x < project.tileWidth && point.y < project.tileHeight;
  }

  function remember(project, point, seen) {
    if (!inBounds(project, point)) return;
    const i = point.y * project.tileWidth + point.x;
    if (seen.has(i)) return;
    seen.set(i, { i, char: project.tileChars[i], color: project.tileColors[i] });
  }

  function plot(project, point, seen, clip) {
    const ink = session.ui.tileInk & (project.mode === "multi" ? 7 : 15);
    const writeChar = session.ui.tileTool === "char";
    eachStampCell(project, point, (cell) => {
      remember(project, cell, seen);
      const i = cell.y * project.tileWidth + cell.x;
      if (writeChar) project.tileChars[i] = cell.char;
      project.tileColors[i] = ink;
    }, clip);
  }

  function line(project, from, to, seen) {
    let x0 = from.x;
    let y0 = from.y;
    const x1 = to.x;
    const y1 = to.y;
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    while (true) {
      plot(project, { x: x0, y: y0 }, seen);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  function changedCells(project, seen) {
    const cells = [];
    for (const prev of seen.values()) {
      if (project.tileChars[prev.i] !== prev.char || project.tileColors[prev.i] !== prev.color) {
        cells.push(prev);
      }
    }
    return cells;
  }

  function finish(commit) {
    if (!stroke) return;
    const project = session.project;
    if (!commit) {
      for (const prev of stroke.seen.values()) {
        project.tileChars[prev.i] = prev.char;
        project.tileColors[prev.i] = prev.color;
      }
      stroke = null;
      session.emit("tiles");
      return;
    }
    if (stroke.shape === "select" && stroke.current) {
      session.ui.tileSelection = tileRectFromCorners(
        stroke.origin,
        stroke.current,
        project.tileWidth,
        project.tileHeight,
      );
      stroke = null;
      session.emit("tiles");
      return;
    }
    if (stroke.shape === "area" && stroke.current) {
      const x0 = Math.min(stroke.origin.x, stroke.current.x);
      const x1 = Math.max(stroke.origin.x, stroke.current.x);
      const y0 = Math.min(stroke.origin.y, stroke.current.y);
      const y1 = Math.max(stroke.origin.y, stroke.current.y);
      const stamp = selectionRect(project);
      const clip = { x0, x1, y0, y1 };
      for (let y = y0; y <= y1; y += stamp.height) {
        for (let x = x0; x <= x1; x += stamp.width) {
          plot(project, { x, y }, stroke.seen, clip);
        }
      }
    }
    const cells = changedCells(project, stroke.seen);
    pushTileUndo(project, cells);
    if (cells.length > 0) session.ui.dirty = true;
    stroke = null;
    session.emit("tiles");
  }

  function placeCursor(point) {
    session.ui.tileCursor = { x: point.x, y: point.y, homeX: point.x };
    session.ui.lastSurface = "tile";
    session.emit("tiles");
  }

  function startStroke(event) {
    const point = cellAt(event);
    if (!inBounds(session.project, point)) return false;
    if (session.ui.tileShape === "type") {
      placeCursor(point);
      return false;
    }
    stroke = {
      shape: session.ui.tileShape,
      origin: point,
      last: point,
      current: point,
      seen: new Map(),
    };
    session.ui.lastSurface = "tile";
    if (stroke.shape === "pen") {
      plot(session.project, point, stroke.seen);
      session.emit("tiles-live");
    } else {
      drawOverlay();
    }
    return true;
  }

  const DOUBLE_MS = 350;
  const DOUBLE_SLOP = 24;
  let lastTap = null;
  let down = null;
  let skipGesture = false;

  function contentCell(event) {
    const rect = scroller.getBoundingClientRect();
    const size = cellSize();
    return {
      x: (event.clientX - rect.left + scroller.scrollLeft) / size,
      y: (event.clientY - rect.top + scroller.scrollTop) / size,
    };
  }

  function isDouble(event) {
    if (!lastTap || performance.now() - lastTap.time > DOUBLE_MS) return false;
    const dx = event.clientX - lastTap.x;
    const dy = event.clientY - lastTap.y;
    return dx * dx + dy * dy <= DOUBLE_SLOP * DOUBLE_SLOP;
  }

  function toggleZoom(point) {
    const project = session.project;
    const next = project.zoom.tiles === 1 ? 2 : 1;
    const size = 8 * next;
    project.zoom.tiles = next;
    session.ui.dirty = true;
    const contentX = point.x * size;
    const contentY = point.y * size;
    session.emit("view");
    scroller.scrollLeft = contentX - scroller.clientWidth / 2;
    const frameTop = scroller.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(window.scrollX, Math.max(0, frameTop + contentY - window.innerHeight / 2));
    draw();
    drawOverlay();
  }

  function noteTap(event, pushedUndo) {
    lastTap = {
      time: performance.now(),
      x: event.clientX,
      y: event.clientY,
      pushedUndo,
    };
  }

  function commitPointer(event) {
    const before = session.project.tileUndo.length;
    const tap = down && !down.moved;
    finish(true);
    if (tap) noteTap(event, session.project.tileUndo.length > before);
    else lastTap = null;
    down = null;
  }

  scroller.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (isDouble(event)) {
      skipGesture = true;
      const point = contentCell(event);
      if (lastTap.pushedUndo) undoTile(session.project);
      lastTap = null;
      down = null;
      toggleZoom(point);
      return;
    }
    down = { x: event.clientX, y: event.clientY, moved: false };
    if (touchUsesTap(event, { draws: true })) return;
    if (!startStroke(event)) return;
    try { scroller.setPointerCapture(event.pointerId); } catch { /* pointer already gone */ }
  });
  bindTap(scroller, {
    enabled: (event) => !skipGesture && touchUsesTap(event, { draws: true }),
    onTap: (event) => {
      if (skipGesture) {
        skipGesture = false;
        down = null;
        return;
      }
      if (!startStroke(event)) {
        down = null;
        return;
      }
      commitPointer(event);
    },
  });

  scroller.addEventListener("pointermove", (event) => {
    if (down) {
      const dx = event.clientX - down.x;
      const dy = event.clientY - down.y;
      if (dx * dx + dy * dy > DOUBLE_SLOP * DOUBLE_SLOP) down.moved = true;
    }
    if (!stroke) return;
    const point = cellAt(event);
    if (!point) return;
    if (stroke.shape === "area" || stroke.shape === "select") {
      stroke.current = point;
      drawOverlay();
      return;
    }
    if (point.x === stroke.last.x && point.y === stroke.last.y) return;
    line(session.project, stroke.last, point, stroke.seen);
    stroke.last = point;
    session.emit("tiles-live");
  });

  scroller.addEventListener("pointerup", (event) => {
    if (skipGesture) {
      skipGesture = false;
      down = null;
      return;
    }
    if (touchUsesTap(event, { draws: true })) return;
    commitPointer(event);
  });
  scroller.addEventListener("pointercancel", () => {
    down = null;
    finish(false);
  });
  let drawQueued = false;
  function scheduleDraw() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(() => {
      drawQueued = false;
      draw();
      drawOverlay();
    });
  }

  scroller.addEventListener("scroll", scheduleDraw);
  window.addEventListener("scroll", scheduleDraw, { passive: true });

  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (stroke) {
      finish(false);
      return;
    }
    if (session.ui.tileShape === "type" && session.ui.tileCursor) {
      session.ui.tileCursor = null;
      session.emit("tiles");
      return;
    }
    if (!session.ui.tileSelection) return;
    session.ui.tileSelection = null;
    session.emit("tiles");
  });

  new ResizeObserver(scheduleDraw).observe(frame);

  function screenExtent(project, size) {
    const contentH = project.tileHeight * size;
    const docTop = scroller.getBoundingClientRect().top + window.scrollY;
    const fill = Math.max(0, window.innerHeight - docTop);
    return Math.max(contentH, fill);
  }

  function visibleBand() {
    const rect = scroller.getBoundingClientRect();
    const contentTop = rect.top;
    const contentBottom = rect.top + scroller.clientHeight;
    const viewTop = Math.max(contentTop, 0);
    const viewBottom = Math.min(contentBottom, window.innerHeight);
    if (viewBottom <= viewTop) return null;
    return {
      top: viewTop - contentTop,
      height: viewBottom - viewTop,
      width: scroller.clientWidth || 1,
      left: scroller.scrollLeft,
    };
  }

  function placeLayer(layer, band) {
    layer.style.top = `${band.top}px`;
    layer.style.left = "0";
  }

  let caretOn = true;
  window.setInterval(() => {
    if (session.ui.tileShape !== "type" || !session.ui.tileCursor) return;
    caretOn = !caretOn;
    drawOverlay(true);
  }, 530);

  function revealCell(x, y) {
    const size = cellSize();
    const left = x * size;
    const right = left + size;
    if (left < scroller.scrollLeft) scroller.scrollLeft = left;
    else if (right > scroller.scrollLeft + scroller.clientWidth) {
      scroller.scrollLeft = right - scroller.clientWidth;
    }
    const top = scroller.getBoundingClientRect().top + y * size;
    const bottom = top + size;
    if (top < 0) window.scrollBy(0, top - 8);
    else if (bottom > window.innerHeight) window.scrollBy(0, bottom - window.innerHeight + 8);
  }

  function drawOverlay(fromBlink = false) {
    const band = visibleBand();
    if (!band) return;
    placeLayer(overlay, band);
    const ctx = prepareCanvas(overlay, band.width, band.height);
    ctx.clearRect(0, 0, band.width, band.height);
    const size = cellSize();
    if (!fromBlink) caretOn = true;
    ctx.save();
    ctx.translate(-band.left, -band.top);
    if (stroke && stroke.shape === "area" && stroke.current) {
      const x0 = Math.min(stroke.origin.x, stroke.current.x);
      const y0 = Math.min(stroke.origin.y, stroke.current.y);
      const w = Math.abs(stroke.origin.x - stroke.current.x) + 1;
      const h = Math.abs(stroke.origin.y - stroke.current.y) + 1;
      ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
      ctx.strokeStyle = "#f2f5fb";
      ctx.lineWidth = 1;
      ctx.fillRect(x0 * size, y0 * size, w * size, h * size);
      ctx.strokeRect(x0 * size + 0.5, y0 * size + 0.5, w * size - 1, h * size - 1);
    } else {
      const rect = stroke && stroke.shape === "select" && stroke.current
        ? tileRectFromCorners(stroke.origin, stroke.current, session.project.tileWidth, session.project.tileHeight)
        : session.ui.tileSelection;
      if (rect) {
        ctx.fillStyle = "rgba(142, 176, 255, 0.22)";
        ctx.strokeStyle = "#8eb0ff";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.fillRect(rect.x * size, rect.y * size, rect.width * size, rect.height * size);
        ctx.strokeRect(rect.x * size + 0.5, rect.y * size + 0.5, rect.width * size - 1, rect.height * size - 1);
        ctx.setLineDash([]);
      }
    }
    const cursor = session.ui.tileShape === "type" ? session.ui.tileCursor : null;
    if (cursor && caretOn) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
      ctx.strokeStyle = "#f4f7ff";
      ctx.lineWidth = 1;
      ctx.fillRect(cursor.x * size, cursor.y * size, size, size);
      ctx.strokeRect(cursor.x * size + 0.5, cursor.y * size + 0.5, size - 1, size - 1);
    }
    ctx.restore();
  }

  function draw() {
    const project = session.project;
    scroller.classList.toggle("selecting", session.ui.tileShape === "select");
    scroller.classList.toggle("typing", session.ui.tileShape === "type");
    const size = cellSize();
    spacer.style.width = `${project.tileWidth * size}px`;
    spacer.style.height = `${screenExtent(project, size)}px`;
    const band = visibleBand();
    if (!band) return;
    placeLayer(canvas, band);
    const ctx = prepareCanvas(canvas, band.width, band.height);
    ctx.clearRect(0, 0, band.width, band.height);
    const x0 = Math.max(0, Math.floor(band.left / size));
    const y0 = Math.max(0, Math.floor(band.top / size));
    const x1 = Math.min(project.tileWidth, Math.ceil((band.left + band.width) / size));
    const y1 = Math.min(project.tileHeight, Math.ceil((band.top + band.height) / size));
    const base = project.activeSet === "lower" ? 2048 : 0;
    ctx.save();
    ctx.translate(-band.left, -band.top);
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const i = y * project.tileWidth + x;
        const index = project.tileChars[i];
        const bytes = project.characters.subarray(base + index * 8, base + index * 8 + 8);
        const ink = displayInk(project, project.tileColors[i]);
        drawGlyph(ctx, bytes, x * size, y * size, project.zoom.tiles, project.mode, project.colors, ink);
      }
    }
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 1) {
      ctx.moveTo(x * size + 0.5, y0 * size);
      ctx.lineTo(x * size + 0.5, y1 * size);
    }
    for (let y = y0; y <= y1; y += 1) {
      ctx.moveTo(x0 * size, y * size + 0.5);
      ctx.lineTo(x1 * size, y * size + 0.5);
    }
    ctx.stroke();
    ctx.restore();
  }

  return { draw, drawOverlay, revealCell };
}
