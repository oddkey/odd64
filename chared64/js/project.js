export const CHARSET_BYTES = 4096;
export const GLYPH_BYTES = 8;
export const GLYPH_COUNT = 256;
export const MAP_COLUMNS = 16;
export const MAP_ROWS = 16;
export const TILE_MAX = 256;
export const UNDO_LIMIT = 100;
export const MAP_ZOOMS = [1, 2, 4, 8, 16];
export const EDITOR_ZOOMS = [16, 32, 64, 128, 256];
export const CLIPBOARD_KIND = "chared64-glyphs";
export const CLIPBOARD_STORAGE_KEY = "chared64.clipboard";

export function fitZoom(availableCss, sourcePixels, dpr = 1) {
  if (!(availableCss > 0) || !(sourcePixels > 0)) return 0;
  const scale = dpr > 0 ? dpr : 1;
  const devicePerSource = Math.max(1, Math.floor((availableCss * scale) / sourcePixels));
  return devicePerSource / scale;
}

export const DEFAULTS = {
  name: "untitled",
  background: 6,
  foreground: 14,
  multi1: 1,
  multi2: 2,
  multiCell: 7,
  mapZoom: 2,
  editorZoom: 32,
  tileZoom: 2,
  tileWidth: 40,
  tileHeight: 25,
  fillChar: 32,
};

function trimUndo(stack) {
  while (stack.length > UNDO_LIMIT) stack.shift();
}

export function glyphOffset(set, index) {
  return (set === "lower" ? 2048 : 0) + index * GLYPH_BYTES;
}

export function cellCol(index) {
  return index % MAP_COLUMNS;
}

export function cellRow(index) {
  return Math.floor(index / MAP_COLUMNS);
}

export function cellIndex(col, row) {
  return row * MAP_COLUMNS + col;
}

export function rectFromCorners(a, b) {
  const col = Math.min(cellCol(a), cellCol(b));
  const row = Math.min(cellRow(a), cellRow(b));
  return {
    col,
    row,
    width: Math.abs(cellCol(a) - cellCol(b)) + 1,
    height: Math.abs(cellRow(a) - cellRow(b)) + 1,
  };
}

export function selectionRect(project) {
  return rectFromCorners(project.selectAnchor ?? project.selected, project.selected);
}

export function eachStampCell(project, origin, visit, clip) {
  const stamp = selectionRect(project);
  for (let dy = 0; dy < stamp.height; dy += 1) {
    for (let dx = 0; dx < stamp.width; dx += 1) {
      const x = origin.x + dx;
      const y = origin.y + dy;
      if (clip && (x < clip.x0 || x > clip.x1 || y < clip.y0 || y > clip.y1)) continue;
      if (x < 0 || y < 0 || x >= project.tileWidth || y >= project.tileHeight) continue;
      visit({ x, y, char: cellIndex(stamp.col + dx, stamp.row + dy) });
    }
  }
}

export function defaultInk(project) {
  return project.mode === "multi" ? project.colors.multiCell : project.colors.foreground;
}

export function colorKeyForRole(role) {
  return role === "cell" ? "multiCell" : role;
}

export function createBlankProject() {
  const count = DEFAULTS.tileWidth * DEFAULTS.tileHeight;
  const tileChars = new Uint8Array(count);
  const tileColors = new Uint8Array(count);
  tileChars.fill(DEFAULTS.fillChar);
  tileColors.fill(DEFAULTS.foreground);
  return {
    name: DEFAULTS.name,
    mode: "single",
    activeSet: "upper",
    colors: {
      background: DEFAULTS.background,
      foreground: DEFAULTS.foreground,
      multi1: DEFAULTS.multi1,
      multi2: DEFAULTS.multi2,
      multiCell: DEFAULTS.multiCell,
    },
    zoom: {
      characters: DEFAULTS.mapZoom,
      editor: DEFAULTS.editorZoom,
      tiles: DEFAULTS.tileZoom,
    },
    tileWidth: DEFAULTS.tileWidth,
    tileHeight: DEFAULTS.tileHeight,
    characters: new Uint8Array(CHARSET_BYTES),
    tileChars,
    tileColors,
    selected: 0,
    selectAnchor: 0,
    copyFrom: null,
    glyphUndo: [],
    tileUndo: [],
  };
}

export function createFromRom(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== CHARSET_BYTES) {
    throw new Error("c64.bin must be 4096 bytes.");
  }
  const project = createBlankProject();
  project.characters.set(bytes);
  return project;
}

export function resizeTiles(project, width, height) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > TILE_MAX ||
    height > TILE_MAX
  ) {
    throw new Error("Tile width and height must be whole numbers from 1 to 256.");
  }
  if (width === project.tileWidth && height === project.tileHeight) return false;
  const nextChars = new Uint8Array(width * height);
  const nextColors = new Uint8Array(width * height);
  const ink = defaultInk(project);
  nextChars.fill(DEFAULTS.fillChar);
  nextColors.fill(ink);
  const copyW = Math.min(width, project.tileWidth);
  const copyH = Math.min(height, project.tileHeight);
  for (let y = 0; y < copyH; y += 1) {
    for (let x = 0; x < copyW; x += 1) {
      const from = y * project.tileWidth + x;
      const to = y * width + x;
      nextChars[to] = project.tileChars[from];
      nextColors[to] = project.tileColors[from];
    }
  }
  project.tileWidth = width;
  project.tileHeight = height;
  project.tileChars = nextChars;
  project.tileColors = nextColors;
  project.tileUndo = [];
  return true;
}

export function getPixel(bytes, mode, x, y) {
  if (mode === "single") return (bytes[y] >> (7 - x)) & 1;
  return (bytes[y] >> (6 - x * 2)) & 3;
}

export function setPixel(bytes, mode, x, y, value) {
  if (y < 0 || y > 7) return false;
  if (mode === "single") {
    if (x < 0 || x > 7) return false;
    const mask = 0x80 >> x;
    const on = (bytes[y] & mask) !== 0;
    if (on === (value === 1)) return false;
    bytes[y] = value === 1 ? bytes[y] | mask : bytes[y] & ~mask;
    return true;
  }
  if (x < 0 || x > 3) return false;
  const shift = 6 - x * 2;
  const mask = 0b11 << shift;
  const current = (bytes[y] & mask) >> shift;
  const next = value & 3;
  if (current === next) return false;
  bytes[y] = (bytes[y] & ~mask) | (next << shift);
  return true;
}

export function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function undoGlyph(project) {
  const entry = project.glyphUndo.pop();
  if (!entry) return false;
  const cells = entry.cells ?? [entry];
  for (const cell of cells) {
    project.characters.set(cell.bytes, glyphOffset(cell.set, cell.index));
  }
  project.activeSet = entry.set;
  project.selected = entry.index;
  project.selectAnchor = entry.index;
  return true;
}

export function undoTile(project) {
  const entry = project.tileUndo.pop();
  if (!entry) return false;
  for (const cell of entry) {
    project.tileChars[cell.i] = cell.char;
    project.tileColors[cell.i] = cell.color;
  }
  return true;
}

export function pushGlyphUndo(project, entry) {
  project.glyphUndo.push(entry);
  trimUndo(project.glyphUndo);
}

export function pushTileUndo(project, cells) {
  if (cells.length === 0) return;
  project.tileUndo.push(cells);
  trimUndo(project.tileUndo);
}

export function markCopy(project) {
  const rect = selectionRect(project);
  const glyphs = [];
  for (let y = 0; y < rect.height; y += 1) {
    for (let x = 0; x < rect.width; x += 1) {
      const from = glyphOffset(project.activeSet, cellIndex(rect.col + x, rect.row + y));
      glyphs.push(Array.from(project.characters.subarray(from, from + GLYPH_BYTES)));
    }
  }
  project.copyFrom = {
    kind: CLIPBOARD_KIND,
    set: project.activeSet,
    index: cellIndex(rect.col, rect.row),
    width: rect.width,
    height: rect.height,
    glyphs,
  };
  return project.copyFrom;
}

export function parseGlyphClipboard(raw) {
  let data = raw;
  if (typeof raw === "string") {
    if (!raw) return null;
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  if (data.kind != null && data.kind !== CLIPBOARD_KIND) return null;
  const width = data.width ?? 1;
  const height = data.height ?? 1;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > MAP_COLUMNS ||
    height > MAP_ROWS
  ) {
    return null;
  }
  if (data.glyphs) {
    if (!Array.isArray(data.glyphs) || data.glyphs.length !== width * height) return null;
    const glyphs = [];
    for (const glyph of data.glyphs) {
      if (!Array.isArray(glyph) || glyph.length !== GLYPH_BYTES) return null;
      const bytes = [];
      for (const value of glyph) {
        if (!Number.isInteger(value) || value < 0 || value > 255) return null;
        bytes.push(value);
      }
      glyphs.push(bytes);
    }
    return {
      kind: CLIPBOARD_KIND,
      set: data.set === "lower" ? "lower" : "upper",
      index: Number.isInteger(data.index) ? data.index : 0,
      width,
      height,
      glyphs,
    };
  }
  if ((data.set === "upper" || data.set === "lower") && Number.isInteger(data.index)) {
    return { set: data.set, index: data.index, width, height };
  }
  return null;
}

export function pasteCopy(project, clip = project.copyFrom) {
  const source = parseGlyphClipboard(clip);
  if (!source) return false;
  const srcWidth = source.width ?? 1;
  const srcHeight = source.height ?? 1;
  const srcCol = cellCol(source.index);
  const srcRow = cellRow(source.index);
  const dest = selectionRect(project);
  const width = Math.min(srcWidth, MAP_COLUMNS - dest.col);
  const height = Math.min(srcHeight, MAP_ROWS - dest.row);
  const snapshots = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let bytes;
      if (source.glyphs) {
        bytes = Uint8Array.from(source.glyphs[y * srcWidth + x]);
      } else {
        const from = glyphOffset(source.set, cellIndex(srcCol + x, srcRow + y));
        bytes = project.characters.slice(from, from + GLYPH_BYTES);
      }
      snapshots.push({
        index: cellIndex(dest.col + x, dest.row + y),
        bytes,
      });
    }
  }
  const cells = [];
  for (const shot of snapshots) {
    const to = glyphOffset(project.activeSet, shot.index);
    const before = project.characters.slice(to, to + GLYPH_BYTES);
    if (sameBytes(shot.bytes, before)) continue;
    cells.push({ set: project.activeSet, index: shot.index, bytes: before });
    project.characters.set(shot.bytes, to);
  }
  if (cells.length === 0) return false;
  pushGlyphUndo(project, {
    set: project.activeSet,
    index: project.selected,
    cells,
  });
  return true;
}

export function fileStem(name) {
  const cleaned = String(name || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-");
  return cleaned || DEFAULTS.name;
}

export function formatCode(index) {
  return `${index}  $${index.toString(16).toUpperCase().padStart(2, "0")}`;
}
