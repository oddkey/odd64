import { C64_COLORS, C64_NAMES } from "./colors.js";
import { parseProjectText, serializeProject } from "./files.js";
import {
  EDITOR_ZOOMS,
  MAP_ZOOMS,
  fitZoom,
  colorKeyForRole,
  createBlankProject,
  createFromRom,
  fileStem,
  formatCode,
  markCopy,
  parseGlyphClipboard,
  pasteCopy,
  resizeTiles,
  selectionRect,
  undoGlyph,
  undoTile,
  CLIPBOARD_STORAGE_KEY,
  GLYPH_COUNT,
  MAP_COLUMNS,
  MAP_ROWS,
} from "./project.js";
import { mountEditor } from "./editor-panel.js";
import { mountMap } from "./map-panel.js";
import { createSession } from "./session.js";
import { contentBoxWidth } from "./render.js";
import { mountTiles } from "./tile-panel.js";

const $ = (id) => document.getElementById(id);

const session = createSession(createBlankProject());
const map = mountMap(session);
const editor = mountEditor(session);
const tiles = mountTiles(session);

const nameInput = $("project-name");
const status = $("status");
const charLabel = $("char-label");
const copyLabel = $("copy-label");
const undoGlyphButton = $("undo-glyph");
const undoTileButton = $("undo-tile");
const pasteButton = $("paste");
const zoomMap = $("zoom-map");
const zoomEditor = $("zoom-editor");
const zoomTile = $("zoom-tile");
const tileW = $("tile-w");
const tileH = $("tile-h");
  const palette = $("palette");
  const tilePalette = $("tile-palette");
const roles = $("paint-roles");
const importInput = $("import-file");

let statusTimer = 0;

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
  status.title = message;
  window.clearTimeout(statusTimer);
  if (!isError && message) {
    statusTimer = window.setTimeout(() => {
      if (status.textContent === message) status.textContent = "";
    }, 4000);
  }
}

function confirmReplace() {
  if (!session.ui.dirty) return true;
  return window.confirm("This project has unsaved changes. Replace it?");
}

function fillZoom(select, values, includeCustom = false) {
  if (includeCustom) {
    const custom = document.createElement("option");
    custom.value = "custom";
    custom.textContent = "Custom";
    select.append(custom);
  }
  for (const value of values) {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = `${value}×`;
    select.append(option);
  }
}

function download(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function syncPressed(group, value) {
  for (const button of group.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.value === value));
  }
}

function armedColor() {
  const { project, ui } = session;
  if (project.mode === "single") {
    return ui.paintRole === "background" ? project.colors.background : project.colors.foreground;
  }
  if (ui.paintRole === "background") return project.colors.background;
  if (ui.paintRole === "multi1") return project.colors.multi1;
  if (ui.paintRole === "multi2") return project.colors.multi2;
  return project.colors.multiCell;
}

function roleDefs() {
  if (session.project.mode === "single") {
    return [
      ["background", "Background", session.project.colors.background],
      ["foreground", "Foreground", session.project.colors.foreground],
    ];
  }
  return [
    ["background", "Background", session.project.colors.background],
    ["multi1", "Multicolor 1", session.project.colors.multi1],
    ["multi2", "Multicolor 2", session.project.colors.multi2],
    ["cell", "Cell color", session.project.colors.multiCell],
  ];
}

function syncChrome() {
  const project = session.project;
  if (document.activeElement !== nameInput) nameInput.value = project.name;
  charLabel.textContent = formatSelection(project);
  copyLabel.textContent = formatCopyLabel();
  undoGlyphButton.disabled = project.glyphUndo.length === 0;
  undoTileButton.disabled = project.tileUndo.length === 0;
  pasteButton.disabled = !pasteClip();
  zoomMap.value = session.ui.fitCharacters ? "custom" : String(project.zoom.characters);
  zoomEditor.value = session.ui.fitEditor ? "custom" : String(project.zoom.editor);
  zoomTile.value = String(project.zoom.tiles);
  mapBody.classList.toggle("fit-width", session.ui.fitCharacters);
  editorBody.classList.toggle("fit-width", session.ui.fitEditor);
  if (document.activeElement !== tileW) tileW.value = String(project.tileWidth);
  if (document.activeElement !== tileH) tileH.value = String(project.tileHeight);
  syncPressed($("bank-seg"), project.activeSet);
  syncPressed($("mode-seg"), project.mode);
  syncPressed($("touch-mode"), session.ui.touchDraw ? "draw" : "scroll");
  document.body.classList.toggle("draw-mode", session.ui.touchDraw);
  syncPressed($("tile-tool"), session.ui.tileTool);
  syncPressed($("tile-shape"), session.ui.tileShape);

  const selected = armedColor();
  const limitCell = project.mode === "multi" && session.ui.paintRole === "cell";
  for (const swatch of palette.children) {
    const index = Number(swatch.dataset.index);
    swatch.setAttribute("aria-checked", String(index === selected));
    swatch.disabled = limitCell && index > 7;
  }
  const tileInk = project.mode === "multi" ? session.ui.tileInk & 7 : session.ui.tileInk & 15;
  for (const swatch of tilePalette.children) {
    const index = Number(swatch.dataset.index);
    swatch.setAttribute("aria-checked", String(index === tileInk));
    swatch.disabled = project.mode === "multi" && index > 7;
  }

  roles.replaceChildren();
  for (const [value, label, color] of roleDefs()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "role";
    button.setAttribute("aria-pressed", String(session.ui.paintRole === value));
    const chip = document.createElement("i");
    chip.style.background = C64_COLORS[color];
    button.append(chip, document.createTextNode(label));
    button.addEventListener("click", () => {
      session.ui.paintRole = value;
      session.ui.lastSurface = "editor";
      session.emit("chrome");
    });
    roles.append(button);
  }
}

function render(reason) {
  if (reason === "pixels-live") {
    editor.draw();
    return;
  }
  if (reason === "tiles-live") {
    tiles.draw();
    return;
  }
  if (reason === "chrome") {
    syncChrome();
    return;
  }
  map.draw();
  editor.draw();
  tiles.draw();
  tiles.drawOverlay();
  syncChrome();
}

function assignColor(index) {
  const { project, ui } = session;
  if (project.mode === "multi" && ui.paintRole === "cell" && index > 7) {
    setStatus("Multicolor cell colors are 0–7.", true);
    return;
  }
  session.setColor(colorKeyForRole(ui.paintRole), index);
}

async function loadRom() {
  const response = await fetch("c64.bin");
  if (!response.ok) throw new Error(`Could not load c64.bin (${response.status}).`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return createFromRom(bytes);
}

function replaceWith(project, message) {
  session.replaceProject(project);
  setStatus(message);
}

fillZoom(zoomMap, MAP_ZOOMS, true);
fillZoom(zoomEditor, EDITOR_ZOOMS, true);
fillZoom(zoomTile, MAP_ZOOMS);

const mapBody = document.querySelector(".map .panel-body");
const editorBody = document.querySelector(".editor .panel-body");
const phoneScreen = window.matchMedia("(max-width: 980px)");
if (phoneScreen.matches) {
  session.ui.fitCharacters = true;
  session.ui.fitEditor = true;
}

let fittedMap = 0;
let fittedEditor = 0;
const fitObserver = new ResizeObserver(() => {
  if (!session.ui.fitCharacters && !session.ui.fitEditor) return;
  const dpr = window.devicePixelRatio || 1;
  const nextMap = session.ui.fitCharacters ? fitZoom(contentBoxWidth(mapBody), 128, dpr) : 0;
  const nextEditor = session.ui.fitEditor ? fitZoom(contentBoxWidth(editorBody), 8, dpr) : 0;
  if (nextMap === fittedMap && nextEditor === fittedEditor) return;
  fittedMap = nextMap;
  fittedEditor = nextEditor;
  session.emit("view");
});
fitObserver.observe(mapBody);
fitObserver.observe(editorBody);

for (let index = 0; index < 16; index += 1) {
  const swatch = document.createElement("button");
  swatch.type = "button";
  swatch.className = "swatch";
  swatch.dataset.index = String(index);
  swatch.style.background = C64_COLORS[index];
  swatch.title = `${index} ${C64_NAMES[index]}`;
  swatch.setAttribute("role", "radio");
  swatch.setAttribute("aria-label", C64_NAMES[index]);
  swatch.addEventListener("click", () => assignColor(index));
  palette.append(swatch);

  const tileSwatch = document.createElement("button");
  tileSwatch.type = "button";
  tileSwatch.className = "swatch";
  tileSwatch.dataset.index = String(index);
  tileSwatch.style.background = C64_COLORS[index];
  tileSwatch.title = `${index} ${C64_NAMES[index]}`;
  tileSwatch.setAttribute("role", "radio");
  tileSwatch.setAttribute("aria-label", `Screen ${C64_NAMES[index]}`);
  tileSwatch.addEventListener("click", () => assignTileInk(index));
  tilePalette.append(tileSwatch);
}

function formatCopy(copyFrom) {
  const width = copyFrom.width ?? 1;
  const height = copyFrom.height ?? 1;
  if (width === 1 && height === 1) return formatCode(copyFrom.index);
  return `${width}×${height} at ${formatCode(copyFrom.index)}`;
}

function pasteClip() {
  return session.project.copyFrom || session.ui.clipboard;
}

function formatCopyLabel() {
  const local = session.project.copyFrom;
  if (local) return `Copy ${formatCopy(local)}`;
  const remote = session.ui.clipboard;
  if (!remote) return "Copy none";
  const width = remote.width ?? 1;
  const height = remote.height ?? 1;
  return width === 1 && height === 1 ? "Copy from another tab" : `Copy ${width}×${height} from another tab`;
}

function writeSharedClipboard(clip) {
  const text = JSON.stringify(clip);
  try {
    localStorage.setItem(CLIPBOARD_STORAGE_KEY, text);
  } catch {
    /* private mode */
  }
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

async function readSharedClipboard() {
  if (navigator.clipboard?.readText) {
    try {
      const parsed = parseGlyphClipboard(await navigator.clipboard.readText());
      if (parsed) return parsed;
    } catch {
      /* permission or empty */
    }
  }
  try {
    return parseGlyphClipboard(localStorage.getItem(CLIPBOARD_STORAGE_KEY));
  } catch {
    return null;
  }
}

function copySelection() {
  const clip = markCopy(session.project);
  session.ui.clipboard = clip;
  writeSharedClipboard(clip);
  session.emit("selection");
  setStatus(`Copied ${formatCopy(clip)}.`);
}

async function pasteSelection() {
  const clip = (await readSharedClipboard()) || pasteClip();
  if (!clip) {
    setStatus("Nothing to paste.", true);
    return;
  }
  session.ui.clipboard = clip;
  if (!runEdit("pixels", (project) => pasteCopy(project, clip))) setStatus("Paste made no change.");
}

function formatSelection(project) {
  const rect = selectionRect(project);
  if (rect.width === 1 && rect.height === 1) return formatCode(project.selected);
  return `${formatCode(project.selected)} · ${rect.width}×${rect.height}`;
}

function moveMapIndex(index, key, clamp) {
  const col = index % MAP_COLUMNS;
  const row = Math.floor(index / MAP_COLUMNS);
  if (key === "ArrowLeft") {
    return clamp ? row * MAP_COLUMNS + Math.max(0, col - 1) : (index + GLYPH_COUNT - 1) % GLYPH_COUNT;
  }
  if (key === "ArrowRight") {
    return clamp ? row * MAP_COLUMNS + Math.min(MAP_COLUMNS - 1, col + 1) : (index + 1) % GLYPH_COUNT;
  }
  if (key === "ArrowUp") {
    return clamp ? Math.max(0, row - 1) * MAP_COLUMNS + col : (index + GLYPH_COUNT - MAP_COLUMNS) % GLYPH_COUNT;
  }
  if (key === "ArrowDown") {
    return clamp ? Math.min(MAP_ROWS - 1, row + 1) * MAP_COLUMNS + col : (index + MAP_COLUMNS) % GLYPH_COUNT;
  }
  return null;
}

function assignTileInk(index) {
  if (session.project.mode === "multi" && index > 7) {
    setStatus("Multicolor cell colors are 0–7.", true);
    return;
  }
  session.ui.tileInk = index;
  session.ui.lastSurface = "tile";
  session.emit("chrome");
}

session.subscribe(render);

try {
  session.ui.clipboard = parseGlyphClipboard(localStorage.getItem(CLIPBOARD_STORAGE_KEY));
} catch {
  session.ui.clipboard = null;
}

window.addEventListener("storage", (event) => {
  if (event.key !== CLIPBOARD_STORAGE_KEY) return;
  session.ui.clipboard = parseGlyphClipboard(event.newValue);
  session.emit("chrome");
});

nameInput.addEventListener("input", () => session.setName(nameInput.value));
zoomMap.addEventListener("change", () => {
  if (zoomMap.value === "custom") {
    session.ui.fitCharacters = true;
    fittedMap = 0;
    session.emit("view");
    return;
  }
  session.ui.fitCharacters = false;
  session.setZoom("characters", Number(zoomMap.value));
});
zoomEditor.addEventListener("change", () => {
  if (zoomEditor.value === "custom") {
    session.ui.fitEditor = true;
    fittedEditor = 0;
    session.emit("view");
    return;
  }
  session.ui.fitEditor = false;
  session.setZoom("editor", Number(zoomEditor.value));
});
zoomTile.addEventListener("change", () => session.setZoom("tiles", Number(zoomTile.value)));

$("bank-seg").addEventListener("click", (event) => {
  const value = event.target.closest("button")?.dataset.value;
  if (value) session.setBank(value);
});
$("touch-mode").addEventListener("click", (event) => {
  const value = event.target.closest("button")?.dataset.value;
  if (value !== "scroll" && value !== "draw") return;
  session.ui.touchDraw = value === "draw";
  session.emit("chrome");
});
$("mode-seg").addEventListener("click", (event) => {
  const value = event.target.closest("button")?.dataset.value;
  if (value) session.setMode(value);
});
$("tile-tool").addEventListener("click", (event) => {
  const value = event.target.closest("button")?.dataset.value;
  if (!value) return;
  session.ui.tileTool = value;
  session.ui.lastSurface = "tile";
  session.emit("chrome");
});
$("tile-shape").addEventListener("click", (event) => {
  const value = event.target.closest("button")?.dataset.value;
  if (!value) return;
  session.ui.tileShape = value;
  session.ui.lastSurface = "tile";
  session.emit("chrome");
});

$("new-rom").addEventListener("click", async () => {
  if (!confirmReplace()) return;
  try {
    replaceWith(await loadRom(), "Started from the original character ROM.");
  } catch (error) {
    setStatus(error.message, true);
  }
});

$("new-blank").addEventListener("click", () => {
  if (!confirmReplace()) return;
  replaceWith(createBlankProject(), "Started a blank character set.");
});

$("import-btn").addEventListener("click", () => {
  if (!confirmReplace()) return;
  importInput.click();
});

importInput.addEventListener("change", async () => {
  const file = importInput.files?.[0];
  importInput.value = "";
  if (!file) return;
  const result = parseProjectText(await file.text());
  if (!result.ok) {
    setStatus(result.error, true);
    return;
  }
  replaceWith(result.project, `Imported ${result.project.name || "project"}.`);
});

$("export-json").addEventListener("click", () => {
  const project = session.project;
  const json = JSON.stringify(serializeProject(project), null, 2);
  download(`${fileStem(project.name)}.json`, new Blob([json], { type: "application/json" }));
  session.ui.dirty = false;
  setStatus(`Exported ${fileStem(project.name)}.json.`);
});

$("export-bin").addEventListener("click", () => {
  const project = session.project;
  const stem = fileStem(project.name);
  download(`${stem}.bin`, new Blob([project.characters], { type: "application/octet-stream" }));
  setStatus(`Exported ${stem}.bin. The tile screen stays in the JSON project.`);
});

function runEdit(reason, fn) {
  const wasDirty = session.ui.dirty;
  let changed = false;
  session.mutate(reason, (project) => {
    changed = fn(project) !== false;
  });
  if (!changed) session.ui.dirty = wasDirty;
  return changed;
}

$("copy").addEventListener("click", () => copySelection());

$("paste").addEventListener("click", () => {
  pasteSelection();
});

undoGlyphButton.addEventListener("click", () => runEdit("pixels", undoGlyph));
undoTileButton.addEventListener("click", () => runEdit("tiles", undoTile));

$("tile-resize").addEventListener("click", () => {
  const width = Number(tileW.value);
  const height = Number(tileH.value);
  try {
    const changed = runEdit("tiles", (project) => resizeTiles(project, width, height));
    setStatus(changed ? `Screen is ${width}×${height}.` : "Screen size is unchanged.");
  } catch (error) {
    setStatus(error.message, true);
  }
});

window.addEventListener("keydown", (event) => {
  const tag = event.target.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === "z" && !event.shiftKey) {
    event.preventDefault();
    if (session.ui.lastSurface === "tile") runEdit("tiles", undoTile);
    else runEdit("pixels", undoGlyph);
    return;
  }
  if ((event.ctrlKey || event.metaKey) && key === "c") {
    event.preventDefault();
    copySelection();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && key === "v") {
    event.preventDefault();
    pasteSelection();
    return;
  }
  const project = session.project;
  const next = moveMapIndex(project.selected, event.key, event.shiftKey);
  if (next === null) return;
  event.preventDefault();
  session.select(next, { extend: event.shiftKey });
});

window.addEventListener("beforeunload", (event) => {
  if (!session.ui.dirty) return;
  event.preventDefault();
  event.returnValue = "";
});

render("project");

if (location.protocol === "file:") {
  setStatus("Open this folder through a local web server so c64.bin can load.", true);
} else {
  loadRom()
    .then((project) => replaceWith(project, "Loaded the original character ROM."))
    .catch((error) => setStatus(error.message, true));
}
