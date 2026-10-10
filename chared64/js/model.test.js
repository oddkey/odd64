import assert from "node:assert/strict";
import test from "node:test";
import { parseProject, parseProjectText, serializeProject } from "./files.js";
import {
  colorKeyForRole,
  createBlankProject,
  fitZoom,
  createFromRom,
  eachStampCell,
  getPixel,
  markCopy,
  parseGlyphClipboard,
  pasteCopy,
  rectFromCorners,
  resizeTiles,
  selectionRect,
  setPixel,
  undoGlyph,
  undoTile,
} from "./project.js";

test("custom zoom fits the width in whole device pixels", () => {
  const map = fitZoom(370, 128, 3);
  assert.equal(map, 8 / 3);
  assert.ok(128 * map <= 370);
  const editor = fitZoom(370, 8, 3);
  assert.equal(editor, 46);
  assert.ok(8 * editor <= 370);
  assert.equal(fitZoom(0, 128, 2), 0);
});

test("the cell paint role stores the multicolor cell color", () => {
  assert.equal(colorKeyForRole("cell"), "multiCell");
  assert.equal(colorKeyForRole("multi1"), "multi1");
  assert.equal(colorKeyForRole("background"), "background");
});

test("single-color bits are stored with bit 7 at the left", () => {
  const bytes = new Uint8Array(8);
  assert.equal(setPixel(bytes, "single", 0, 0, 1), true);
  assert.equal(setPixel(bytes, "single", 7, 0, 1), true);
  assert.equal(bytes[0], 0b10000001);
  assert.equal(getPixel(bytes, "single", 0, 0), 1);
  assert.equal(getPixel(bytes, "single", 1, 0), 0);
  assert.equal(setPixel(bytes, "single", 0, 0, 0), true);
  assert.equal(bytes[0], 0b00000001);
});

test("multicolor bit pairs follow the VIC-II order", () => {
  const bytes = new Uint8Array(8);
  setPixel(bytes, "multi", 0, 0, 0);
  setPixel(bytes, "multi", 1, 0, 1);
  setPixel(bytes, "multi", 2, 0, 2);
  setPixel(bytes, "multi", 3, 0, 3);
  assert.equal(bytes[0], 0b00011011);
  assert.equal(getPixel(bytes, "multi", 0, 0), 0);
  assert.equal(getPixel(bytes, "multi", 1, 0), 1);
  assert.equal(getPixel(bytes, "multi", 2, 0), 2);
  assert.equal(getPixel(bytes, "multi", 3, 0), 3);
});

test("a blank project is 4096 zero bytes and a 40 by 25 screen of spaces", () => {
  const project = createBlankProject();
  assert.equal(project.characters.length, 4096);
  assert.equal(project.characters[0], 0);
  assert.equal(project.tileWidth, 40);
  assert.equal(project.tileHeight, 25);
  assert.equal(project.tileChars[0], 32);
  assert.equal(project.tileColors[0], 14);
  assert.equal(project.colors.background, 6);
  assert.equal(project.colors.multiCell, 7);
});

test("the original ROM copies both banks", () => {
  const rom = new Uint8Array(4096);
  rom[0] = 0x3c;
  rom[2048] = 0x18;
  const project = createFromRom(rom);
  assert.equal(project.characters[0], 0x3c);
  assert.equal(project.characters[2048], 0x18);
  assert.throws(() => createFromRom(new Uint8Array(2048)), /4096/);
});

test("resize keeps the top-left overlap and clears undo", () => {
  const project = createBlankProject();
  project.tileWidth = 2;
  project.tileHeight = 2;
  project.tileChars = Uint8Array.of(1, 2, 3, 4);
  project.tileColors = Uint8Array.of(5, 6, 7, 8);
  project.tileUndo = [[{ i: 0, char: 1, color: 5 }]];
  assert.equal(resizeTiles(project, 3, 2), true);
  assert.deepEqual(Array.from(project.tileChars), [1, 2, 32, 3, 4, 32]);
  assert.deepEqual(Array.from(project.tileColors), [5, 6, 14, 7, 8, 14]);
  assert.equal(project.tileUndo.length, 0);
  assert.equal(resizeTiles(project, 3, 2), false);
});

test("glyph undo restores the edited bank and character", () => {
  const project = createBlankProject();
  project.characters[0] = 1;
  project.glyphUndo.push({ set: "upper", index: 0, bytes: Uint8Array.of(9, 0, 0, 0, 0, 0, 0, 0) });
  project.characters[0] = 2;
  project.activeSet = "lower";
  project.selected = 4;
  assert.equal(undoGlyph(project), true);
  assert.equal(project.characters[0], 9);
  assert.equal(project.activeSet, "upper");
  assert.equal(project.selected, 0);
});

test("paste copies eight bytes and can be undone", () => {
  const project = createBlankProject();
  project.selected = 1;
  project.selectAnchor = 1;
  project.characters.set([1, 2, 3, 4, 5, 6, 7, 8], 0);
  project.copyFrom = { set: "upper", index: 0 };
  assert.equal(pasteCopy(project), true);
  assert.equal(project.characters[8], 1);
  assert.equal(project.characters[15], 8);
  assert.equal(undoGlyph(project), true);
  assert.equal(project.characters[8], 0);
});

test("shift-click range is the rectangle between two map cells", () => {
  assert.deepEqual(rectFromCorners(0, 18), { col: 0, row: 0, width: 3, height: 2 });
  const project = createBlankProject();
  project.selectAnchor = 0;
  project.selected = 18;
  assert.deepEqual(selectionRect(project), { col: 0, row: 0, width: 3, height: 2 });
});

test("paste copies a rectangular block and one undo restores all cells", () => {
  const project = createBlankProject();
  project.characters.set([1, 2, 3, 4, 5, 6, 7, 8], 0);
  project.characters.set([9, 9, 9, 9, 9, 9, 9, 9], 8);
  project.characters.set([3, 3, 3, 3, 3, 3, 3, 3], 16 * 8);
  project.characters.set([4, 4, 4, 4, 4, 4, 4, 4], 17 * 8);
  project.selectAnchor = 0;
  project.selected = 17;
  markCopy(project);
  assert.equal(project.copyFrom.width, 2);
  assert.equal(project.copyFrom.height, 2);
  assert.equal(project.copyFrom.glyphs.length, 4);
  assert.deepEqual(project.copyFrom.glyphs[0], [1, 2, 3, 4, 5, 6, 7, 8]);
  project.selectAnchor = 2;
  project.selected = 19;
  assert.equal(pasteCopy(project), true);
  assert.deepEqual(Array.from(project.characters.subarray(16, 24)), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(Array.from(project.characters.subarray(24, 32)), [9, 9, 9, 9, 9, 9, 9, 9]);
  assert.deepEqual(Array.from(project.characters.subarray(18 * 8, 19 * 8)), [3, 3, 3, 3, 3, 3, 3, 3]);
  assert.deepEqual(Array.from(project.characters.subarray(19 * 8, 20 * 8)), [4, 4, 4, 4, 4, 4, 4, 4]);
  assert.equal(undoGlyph(project), true);
  assert.deepEqual(Array.from(project.characters.subarray(16, 32)), Array(16).fill(0));
  assert.deepEqual(Array.from(project.characters.subarray(18 * 8, 20 * 8)), Array(16).fill(0));
});

test("block paste clips at the map edge and snapshots overlapping source cells", () => {
  const project = createBlankProject();
  project.characters.set([1, 1, 1, 1, 1, 1, 1, 1], 14 * 8);
  project.characters.set([2, 2, 2, 2, 2, 2, 2, 2], 15 * 8);
  project.selectAnchor = 14;
  project.selected = 15;
  markCopy(project);
  project.selectAnchor = 15;
  project.selected = 15;
  assert.equal(pasteCopy(project), true);
  assert.deepEqual(Array.from(project.characters.subarray(15 * 8, 16 * 8)), [1, 1, 1, 1, 1, 1, 1, 1]);
  assert.equal(project.characters[16 * 8], 0);

  const overlap = createBlankProject();
  overlap.characters.set([1, 1, 1, 1, 1, 1, 1, 1], 0);
  overlap.characters.set([2, 2, 2, 2, 2, 2, 2, 2], 8);
  overlap.selectAnchor = 0;
  overlap.selected = 1;
  markCopy(overlap);
  overlap.selectAnchor = 1;
  overlap.selected = 1;
  assert.equal(pasteCopy(overlap), true);
  assert.deepEqual(Array.from(overlap.characters.subarray(8, 16)), [1, 1, 1, 1, 1, 1, 1, 1]);
  assert.deepEqual(Array.from(overlap.characters.subarray(16, 24)), [2, 2, 2, 2, 2, 2, 2, 2]);
});

test("copied glyphs paste into another project after the source changes", () => {
  const source = createBlankProject();
  source.characters.set([1, 2, 3, 4, 5, 6, 7, 8], 0);
  source.selectAnchor = 0;
  source.selected = 0;
  const clip = parseGlyphClipboard(JSON.stringify(markCopy(source)));
  source.characters[0] = 99;
  const dest = createBlankProject();
  dest.selectAnchor = 5;
  dest.selected = 5;
  assert.equal(pasteCopy(dest, clip), true);
  assert.deepEqual(Array.from(dest.characters.subarray(40, 48)), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(parseGlyphClipboard("not json"), null);
  assert.equal(parseGlyphClipboard({ kind: "other" }), null);
});

test("a multi-selection stamps a block of screen codes", () => {
  const project = createBlankProject();
  project.selectAnchor = 0;
  project.selected = 17;
  const written = [];
  eachStampCell(project, { x: 3, y: 2 }, (cell) => written.push(cell));
  assert.deepEqual(written, [
    { x: 3, y: 2, char: 0 },
    { x: 4, y: 2, char: 1 },
    { x: 3, y: 3, char: 16 },
    { x: 4, y: 3, char: 17 },
  ]);
});

test("a stamp clips to the screen and to an optional area", () => {
  const project = createBlankProject();
  project.tileWidth = 2;
  project.tileHeight = 2;
  project.tileChars = new Uint8Array(4);
  project.selectAnchor = 0;
  project.selected = 17;
  const edge = [];
  eachStampCell(project, { x: 1, y: 1 }, (cell) => edge.push(cell));
  assert.deepEqual(edge, [{ x: 1, y: 1, char: 0 }]);

  project.tileWidth = 40;
  project.tileHeight = 25;
  const clipped = [];
  eachStampCell(project, { x: 5, y: 5 }, (cell) => clipped.push(cell), { x0: 5, x1: 5, y0: 5, y1: 6 });
  assert.deepEqual(clipped, [
    { x: 5, y: 5, char: 0 },
    { x: 5, y: 6, char: 16 },
  ]);
});

test("tile undo restores the previous cells", () => {
  const project = createBlankProject();
  project.tileChars[3] = 9;
  project.tileColors[3] = 2;
  project.tileUndo.push([{ i: 3, char: 32, color: 14 }]);
  assert.equal(undoTile(project), true);
  assert.equal(project.tileChars[3], 32);
  assert.equal(project.tileColors[3], 14);
});

test("JSON round-trips the project and rejects a bad file", () => {
  const project = createBlankProject();
  project.name = "demo";
  project.mode = "multi";
  project.activeSet = "lower";
  project.characters[2048] = 77;
  project.tileChars[1] = 8;
  const parsed = parseProject(serializeProject(project));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.project.name, "demo");
  assert.equal(parsed.project.mode, "multi");
  assert.equal(parsed.project.activeSet, "lower");
  assert.equal(parsed.project.characters[2048], 77);
  assert.equal(parsed.project.tileChars[1], 8);
  assert.equal(parsed.project.tileChars.length, 1000);

  const bad = parseProjectText("{");
  assert.equal(bad.ok, false);
  const short = parseProject({ ...serializeProject(project), characters: [1, 2, 3] });
  assert.equal(short.ok, false);
  assert.match(short.error, /Character data/);
});
