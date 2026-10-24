import { sameBytes } from "./project.js";

export const SPRITE_COUNT = 256;
export const SPRITE_BYTES = 64;
export const SPRITE_PIXEL_W = 24;
export const SPRITE_PIXEL_H = 21;
export const SPRITE_ZOOMS = [4, 6, 8, 12, 16, 24, 32, 48, 64];
export const SPRITE_FRAME_CLIPBOARD_KIND = "chared64-sprite-frame";
export const SPRITE_FRAME_CLIPBOARD_STORAGE_KEY = "chared64.spriteFrameClipboard";

export const ACTION_PRESETS = [
  { type: "walking", name: "Walking", frames: 3 },
  { type: "jumping", name: "Jumping", frames: 1 },
  { type: "climbing", name: "Climbing", frames: 2 },
  { type: "shooting", name: "Shooting", frames: 1 },
  { type: "hit", name: "Being hit", frames: 1 },
  { type: "falling", name: "Falling", frames: 1 },
];

const KIND_LABEL = { player: "Player", enemy: "Enemy", action: "Action" };
const INK_CYCLE = [14, 2, 5, 7, 3, 4, 8, 13];
const FRAME_MAX = 64;
const INTERVAL_MIN = 40;
const INTERVAL_MAX = 2000;

export const DIRECTION_SETS = {
  all: {
    id: "all",
    label: "3×3 — all directions",
    detail: "Eight directions around an idle center.",
    cols: 3,
    rows: 3,
    cells: [
      { id: "nw", label: "Up-left", col: 0, row: 0, key: null },
      { id: "n", label: "Up", col: 1, row: 0, key: "ArrowUp" },
      { id: "ne", label: "Up-right", col: 2, row: 0, key: null },
      { id: "w", label: "Left", col: 0, row: 1, key: "ArrowLeft" },
      { id: "idle", label: "Idle", col: 1, row: 1, key: null },
      { id: "e", label: "Right", col: 2, row: 1, key: "ArrowRight" },
      { id: "sw", label: "Down-left", col: 0, row: 2, key: null },
      { id: "s", label: "Down", col: 1, row: 2, key: "ArrowDown" },
      { id: "se", label: "Down-right", col: 2, row: 2, key: null },
    ],
  },
  cardinal: {
    id: "cardinal",
    label: "2×2 — up, down, left, and right",
    detail: "Four directions.",
    cols: 2,
    rows: 2,
    cells: [
      { id: "up", label: "Up", col: 0, row: 0, key: "ArrowUp" },
      { id: "down", label: "Down", col: 1, row: 0, key: "ArrowDown" },
      { id: "left", label: "Left", col: 0, row: 1, key: "ArrowLeft" },
      { id: "right", label: "Right", col: 1, row: 1, key: "ArrowRight" },
    ],
  },
  horizontal: {
    id: "horizontal",
    label: "1×2 — horizontal only",
    detail: "Platform games. Climbing and jumping are actions, not directions.",
    cols: 2,
    rows: 1,
    cells: [
      { id: "left", label: "Left", col: 0, row: 0, key: "ArrowLeft" },
      { id: "right", label: "Right", col: 1, row: 0, key: "ArrowRight" },
    ],
  },
  vertical: {
    id: "vertical",
    label: "2×1 — vertical only",
    detail: "Up and down.",
    cols: 1,
    rows: 2,
    cells: [
      { id: "up", label: "Up", col: 0, row: 0, key: "ArrowUp" },
      { id: "down", label: "Down", col: 0, row: 1, key: "ArrowDown" },
    ],
  },
};

export function directionSet(id) {
  return DIRECTION_SETS[id] || null;
}

export function gridChoices(dual) {
  const choices = [];
  const add = (w, h) => {
    if (!choices.some((choice) => choice.w === w && choice.h === h)) choices.push({ w, h });
  };
  if (dual) {
    for (let w = 1; w <= 4; w += 1) add(w, 1);
    for (let h = 2; h <= 4; h += 1) add(1, h);
    add(2, 2);
  } else {
    for (let w = 1; w <= 8; w += 1) add(w, 1);
    for (let h = 2; h <= 8; h += 1) add(1, h);
    for (let w = 2; w <= 4; w += 1) add(w, 2);
    for (let h = 3; h <= 4; h += 1) add(2, h);
  }
  return choices;
}

export function gridAllowed(dual, w, h) {
  return gridChoices(dual).some((choice) => choice.w === w && choice.h === h);
}

export function presetFrames(type) {
  return ACTION_PRESETS.find((preset) => preset.type === type)?.frames ?? 1;
}

export function layerMode(actor, layer) {
  if (actor.layers === 1 || layer > 0) return "hires";
  return actor.stack === "over-multi" ? "multi" : "hires";
}

export function cellCount(actor) {
  return actor.grid.width * actor.grid.height;
}

export function colorSlot(actor, gx, gy, layer) {
  return (layer * actor.grid.height + gy) * actor.grid.width + gx;
}

export function cellColor(actor, gx, gy, layer) {
  return actor.colors[colorSlot(actor, gx, gy, layer)] & 15;
}

export function actorPixelSize(actor) {
  return {
    w: actor.grid.width * SPRITE_PIXEL_W,
    h: actor.grid.height * SPRITE_PIXEL_H,
  };
}

export function imagesUsed(project) {
  return usedSpriteIndices(project).size;
}

export function actorById(project, id) {
  return project.actors.find((actor) => actor.id === id) || null;
}

export function spriteBytes(project, index) {
  const offset = index * SPRITE_BYTES;
  return project.sprites.subarray(offset, offset + SPRITE_BYTES);
}

export function getSpritePixel(bytes, mode, x, y) {
  if (y < 0 || y >= SPRITE_PIXEL_H) return 0;
  if (mode === "hires") {
    if (x < 0 || x >= SPRITE_PIXEL_W) return 0;
    const byte = bytes[y * 3 + (x >> 3)];
    return (byte >> (7 - (x & 7))) & 1;
  }
  if (x < 0 || x >= SPRITE_PIXEL_W / 2) return 0;
  const byte = bytes[y * 3 + (x >> 2)];
  return (byte >> (6 - (x & 3) * 2)) & 3;
}

export function setSpritePixel(bytes, mode, x, y, value) {
  if (y < 0 || y >= SPRITE_PIXEL_H) return false;
  if (mode === "hires") {
    if (x < 0 || x >= SPRITE_PIXEL_W) return false;
    const i = y * 3 + (x >> 3);
    const mask = 0x80 >> (x & 7);
    const on = (bytes[i] & mask) !== 0;
    const next = value === 1;
    if (on === next) return false;
    bytes[i] = next ? bytes[i] | mask : bytes[i] & ~mask;
    return true;
  }
  if (x < 0 || x >= SPRITE_PIXEL_W / 2) return false;
  const i = y * 3 + (x >> 2);
  const shift = 6 - (x & 3) * 2;
  const mask = 0b11 << shift;
  const current = (bytes[i] & mask) >> shift;
  const next = value & 3;
  if (current === next) return false;
  bytes[i] = (bytes[i] & ~mask) | (next << shift);
  return true;
}

export function acceptsPaint(actor, gx, gy, layer, paint) {
  if (gx < 0 || gy < 0 || gx >= actor.grid.width || gy >= actor.grid.height) return false;
  if (layer < 0 || layer >= actor.layers) return false;
  if (!paint) return false;
  if (paint.kind === "clear") return true;
  const mode = layerMode(actor, layer);
  if (paint.kind === "multi0" || paint.kind === "multi1") return mode === "multi";
  if (paint.kind === "ink") return mode === "hires" || mode === "multi"
    ? cellColor(actor, gx, gy, layer) === (paint.color & 15)
    : false;
  return false;
}

export function paintValue(actor, layer, paint) {
  if (!paint || paint.kind === "clear") return 0;
  const mode = layerMode(actor, layer);
  if (mode === "hires") return paint.kind === "ink" ? 1 : null;
  if (paint.kind === "multi0") return 1;
  if (paint.kind === "ink") return 2;
  if (paint.kind === "multi1") return 3;
  return null;
}

const SIDE_DIRECTIONS = new Set(["left", "right", "w", "e"]);

export function directionForKey(setId, key) {
  const cell = directionSet(setId)?.cells.find((entry) => entry.key === key);
  return cell ? cell.id : null;
}

export function directionsFor(directionsId, actionType) {
  const set = directionSet(directionsId);
  if (!set) return [];
  if (actionType !== "climbing") return set.cells;
  const kept = set.cells.filter((cell) => !SIDE_DIRECTIONS.has(cell.id));
  if (kept.length > 0) return kept;
  return [{ id: "climb", label: "Climb", col: 0, row: 0, key: null }];
}

export function directionForAction(actor, action, directionId) {
  const dirs = directionsFor(actor.directions, action?.type);
  if (dirs.some((cell) => cell.id === directionId)) return directionId;
  return dirs[0].id;
}

export function displayPose(actor, ui) {
  const pose = ui?.spritePose;
  if (pose && pose.actorId === actor.id) {
    const action = actor.actions.find((entry) => entry.id === pose.actionId) || actor.actions[0];
    const directionId = directionForAction(actor, action, pose.directionId);
    const frame = Math.min(Math.max(pose.frame || 0, 0), action.frames - 1);
    if (slotIndices(actor, action.id, directionId, frame)) {
      return { actorId: actor.id, actionId: action.id, directionId, frame };
    }
  }
  const placed = actor.placement;
  if (placed && slotIndices(actor, placed.actionId, placed.directionId, placed.frame)) {
    return {
      actorId: actor.id,
      actionId: placed.actionId,
      directionId: placed.directionId,
      frame: placed.frame,
    };
  }
  const action = actor.actions[0];
  const direction = directionsFor(actor.directions, action.type)[0];
  return {
    actorId: actor.id,
    actionId: action.id,
    directionId: direction.id,
    frame: 0,
  };
}

export function slotIndices(actor, actionId, directionId, frame) {
  const frames = actor.slots?.[actionId]?.[directionId];
  if (!frames || !Number.isInteger(frame) || frame < 0 || frame >= frames.length) return null;
  return frames[frame];
}

export function eachVisibleSprite(project, actor, pose, visit) {
  const indices = slotIndices(actor, pose.actionId, pose.directionId, pose.frame);
  if (!indices) return;
  const { width, height } = actor.grid;
  for (let layer = 0; layer < actor.layers; layer += 1) {
    for (let gy = 0; gy < height; gy += 1) {
      for (let gx = 0; gx < width; gx += 1) {
        const index = indices[(layer * height + gy) * width + gx];
        visit({
          index,
          bytes: spriteBytes(project, index),
          mode: layerMode(actor, layer),
          color: cellColor(actor, gx, gy, layer),
          multi0: actor.multi0,
          multi1: actor.multi1,
          gx,
          gy,
          layer,
        });
      }
    }
  }
}

export function specImageCount(spec) {
  const layers = spec.layers === 2 ? 2 : 1;
  const cells = spec.gridW * spec.gridH * layers;
  return (spec.actions || []).reduce((sum, action) => {
    return sum + action.frames * directionsFor(spec.directions, action.type).length * cells;
  }, 0);
}

export function createActor(project, spec) {
  const kind = spec.kind;
  if (kind !== "player" && kind !== "enemy" && kind !== "action") {
    return { ok: false, error: "Choose a player, enemy, or action actor." };
  }
  const layers = spec.layers === 2 ? 2 : 1;
  const stack = layers === 1 ? "single" : spec.stack;
  if (layers === 2 && stack !== "over-single" && stack !== "over-multi") {
    return { ok: false, error: "Choose how the two layers combine." };
  }
  if (!gridAllowed(layers === 2, spec.gridW, spec.gridH)) {
    return { ok: false, error: "That sprite grid is not available for this actor." };
  }
  if (!directionSet(spec.directions)) return { ok: false, error: "Choose a direction grid." };
  const actions = normalizeActions(spec.actions);
  if (!actions.ok) return actions;
  const count = specImageCount({ ...spec, layers, actions: actions.actions });
  const free = SPRITE_COUNT - imagesUsed(project);
  if (count > free) {
    return {
      ok: false,
      error: `This actor needs ${count} sprite images and ${free} are free. The editor holds ${SPRITE_COUNT}.`,
    };
  }
  const allocated = takeSprites(project, count);
  const actor = {
    id: String(project.nextActorId),
    name: nextName(project, kind),
    kind,
    layers,
    stack,
    grid: { width: spec.gridW, height: spec.gridH },
    directions: spec.directions,
    actions: actions.actions,
    nextActionId: actions.actions.length + 1,
    slots: {},
    colors: defaultColors(spec.gridW, spec.gridH, layers),
    multi0: 7,
    multi1: 2,
    placement: null,
  };
  project.nextActorId += 1;
  fillSlots(actor, allocated);
  project.actors.push(actor);
  if (spec.template) applyTemplates(project, actor);
  return { ok: true, actor };
}

export function deleteActor(project, actorId) {
  const index = project.actors.findIndex((actor) => actor.id === actorId);
  if (index < 0) return false;
  releaseSprites(project, collectIndices(project.actors[index]));
  project.actors.splice(index, 1);
  return true;
}

export function addActorAction(project, actor, spec) {
  const type = spec.type === "custom" ? "custom" : spec.type;
  const preset = ACTION_PRESETS.find((entry) => entry.type === type);
  if (type !== "custom" && !preset) return { ok: false, error: "Choose an action type." };
  if (type !== "custom" && actor.actions.some((action) => action.type === type)) {
    return { ok: false, error: `${preset.name} is already on this actor.` };
  }
  const name = type === "custom" ? cleanName(spec.name) : preset.name;
  if (!name) return { ok: false, error: "Type a name for the custom action." };
  if (actor.actions.some((action) => action.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: "That action name is already used." };
  }
  const frames = clampFrames(spec.frames, type === "custom" ? 1 : preset.frames);
  const actionDirs = directionsFor(actor.directions, type);
  const need = frames * actionDirs.length * cellCount(actor) * actor.layers;
  const free = SPRITE_COUNT - imagesUsed(project);
  if (need > free) {
    return {
      ok: false,
      error: `This action needs ${need} sprite images and ${free} are free.`,
    };
  }
  const action = {
    id: String(actor.nextActionId),
    type,
    name,
    frames,
    interval: 180,
  };
  actor.nextActionId += 1;
  actor.actions.push(action);
  actor.slots[action.id] = {};
  const allocated = takeSprites(project, need);
  let cursor = 0;
  const per = cellCount(actor) * actor.layers;
  for (const direction of actionDirs) {
    actor.slots[action.id][direction.id] = [];
    for (let frame = 0; frame < frames; frame += 1) {
      actor.slots[action.id][direction.id].push(allocated.slice(cursor, cursor + per));
      cursor += per;
    }
  }
  if (spec.template && type !== "custom") applyTemplates(project, actor, action.id);
  return { ok: true, action };
}

export function removeActorAction(project, actor, actionId) {
  if (actor.actions.length < 2) return { ok: false, error: "An actor keeps at least one action." };
  const index = actor.actions.findIndex((action) => action.id === actionId);
  if (index < 0) return { ok: false, error: "That action is gone." };
  releaseSprites(project, collectActionIndices(actor, actionId));
  delete actor.slots[actionId];
  actor.actions.splice(index, 1);
  return { ok: true };
}

export function setActionFrames(project, actor, actionId, frames) {
  const action = actor.actions.find((entry) => entry.id === actionId);
  if (!action) return { ok: false, error: "That action is gone." };
  if (!Number.isInteger(frames) || frames < 1 || frames > FRAME_MAX) {
    return { ok: false, error: `Frame count must be a whole number from 1 to ${FRAME_MAX}.` };
  }
  if (frames === action.frames) return { ok: true, changed: false };
  const dirs = directionsFor(actor.directions, action.type);
  if (frames > action.frames) {
    const extra = frames - action.frames;
    const need = extra * dirs.length * cellCount(actor) * actor.layers;
    const free = SPRITE_COUNT - imagesUsed(project);
    if (need > free) {
      return { ok: false, error: `Those frames need ${need} sprite images and ${free} are free.` };
    }
    const allocated = takeSprites(project, need);
    let cursor = 0;
    const per = cellCount(actor) * actor.layers;
    for (const direction of dirs) {
      for (let n = 0; n < extra; n += 1) {
        actor.slots[action.id][direction.id].push(allocated.slice(cursor, cursor + per));
        cursor += per;
      }
    }
    action.frames = frames;
    return { ok: true, changed: true };
  }
  for (const direction of dirs) {
    const frameset = actor.slots[action.id][direction.id];
    const dropped = frameset.splice(frames);
    releaseSprites(project, dropped.flat());
  }
  action.frames = frames;
  return { ok: true, changed: true };
}

export function setActionInterval(actor, actionId, interval) {
  const action = actor.actions.find((entry) => entry.id === actionId);
  if (!action) return false;
  if (!Number.isInteger(interval) || interval < INTERVAL_MIN || interval > INTERVAL_MAX) return false;
  if (action.interval === interval) return false;
  action.interval = interval;
  return true;
}

export function setCellColor(actor, gx, gy, layer, color) {
  if (!acceptsPaint(actor, gx, gy, layer, { kind: "clear" })) return false;
  if (!Number.isInteger(color) || color < 0 || color > 15) return false;
  const slot = colorSlot(actor, gx, gy, layer);
  if (actor.colors[slot] === color) return false;
  actor.colors[slot] = color;
  return true;
}

export function setMultiColor(actor, key, color) {
  if (key !== "multi0" && key !== "multi1") return false;
  if (!actorHasMulti(actor)) return false;
  if (!Number.isInteger(color) || color < 0 || color > 15) return false;
  if (actor[key] === color) return false;
  actor[key] = color;
  return true;
}

export function actorHasMulti(actor) {
  for (let layer = 0; layer < actor.layers; layer += 1) {
    if (layerMode(actor, layer) === "multi") return true;
  }
  return false;
}

export function placeActor(actor, x, y, pose) {
  const shown = pose && pose.actorId === actor.id ? pose : displayPose(actor, null);
  actor.placement = {
    x,
    y,
    actionId: shown.actionId,
    directionId: shown.directionId,
    frame: shown.frame || 0,
  };
  return true;
}

export function clearPlacement(actor) {
  if (!actor.placement) return false;
  actor.placement = null;
  return true;
}

export function moveActor(project, actor, key, pose) {
  const wanted = directionForKey(actor.directions, key);
  if (!wanted || !actor.placement) return null;
  const step = 4;
  const delta = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  }[key];
  const size = actorPixelSize(actor);
  const maxX = project.tileWidth * 8 - 8;
  const maxY = project.tileHeight * 8 - 8;
  const x = clamp(actor.placement.x + delta[0], 8 - size.w, maxX);
  const y = clamp(actor.placement.y + delta[1], 8 - size.h, maxY);
  const action = actor.actions.find((entry) => entry.type === "walking")
    || actor.actions.find((entry) => entry.id === pose?.actionId)
    || actor.actions[0];
  const directionId = directionForAction(actor, action, wanted);
  const same = actor.placement.directionId === directionId
    && actor.placement.actionId === action.id;
  const frame = same ? (actor.placement.frame + 1) % action.frames : 0;
  actor.placement.x = x;
  actor.placement.y = y;
  actor.placement.actionId = action.id;
  actor.placement.directionId = directionId;
  actor.placement.frame = frame;
  return {
    actorId: actor.id,
    actionId: action.id,
    directionId,
    frame,
  };
}

export function pushSpriteUndo(project, cells) {
  if (cells.length === 0) return;
  project.spriteUndo.push(cells);
  while (project.spriteUndo.length > 100) project.spriteUndo.shift();
}

export function undoSprite(project) {
  const entry = project.spriteUndo.pop();
  if (!entry) return false;
  for (const cell of entry) spriteBytes(project, cell.index).set(cell.bytes);
  return true;
}

function shownPose(actor, pose) {
  if (pose?.actorId === actor.id) return displayPose(actor, { spritePose: pose });
  if (pose && slotIndices(actor, pose.actionId, pose.directionId, pose.frame)) return pose;
  return displayPose(actor, null);
}

export function framePixelSize(actor) {
  return {
    w: actor.grid.width * SPRITE_PIXEL_W,
    h: actor.grid.height * SPRITE_PIXEL_H,
  };
}

function locateFramePixel(actor, indices, layer, x, y) {
  const gx = Math.floor(x / SPRITE_PIXEL_W);
  const gy = Math.floor(y / SPRITE_PIXEL_H);
  if (gx < 0 || gy < 0 || gx >= actor.grid.width || gy >= actor.grid.height) return null;
  const lx = x - gx * SPRITE_PIXEL_W;
  const ly = y - gy * SPRITE_PIXEL_H;
  const index = indices[(layer * actor.grid.height + gy) * actor.grid.width + gx];
  return { index, lx, ly, mode: layerMode(actor, layer) };
}

function readFramePixel(project, actor, indices, layer, x, y) {
  const hit = locateFramePixel(actor, indices, layer, x, y);
  if (!hit) return 0;
  const bytes = spriteBytes(project, hit.index);
  if (hit.mode === "hires") return getSpritePixel(bytes, "hires", hit.lx, hit.ly);
  return getSpritePixel(bytes, "multi", hit.lx >> 1, hit.ly);
}

function writeFramePixel(project, actor, indices, layer, x, y, value) {
  const hit = locateFramePixel(actor, indices, layer, x, y);
  if (!hit) return;
  const bytes = spriteBytes(project, hit.index);
  if (hit.mode === "hires") setSpritePixel(bytes, "hires", hit.lx, hit.ly, value === 1 ? 1 : 0);
  else setSpritePixel(bytes, "multi", hit.lx >> 1, hit.ly, value & 3);
}

export function clipSpriteRect(actor, rect) {
  if (!rect || !Number.isInteger(rect.x) || !Number.isInteger(rect.y)) return null;
  if (!Number.isInteger(rect.width) || !Number.isInteger(rect.height)) return null;
  if (rect.width < 1 || rect.height < 1) return null;
  const frame = framePixelSize(actor);
  const x0 = Math.max(0, rect.x);
  const y0 = Math.max(0, rect.y);
  const x1 = Math.min(frame.w, rect.x + rect.width);
  const y1 = Math.min(frame.h, rect.y + rect.height);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

function poseIndices(actor, pose) {
  const shown = shownPose(actor, pose);
  const indices = slotIndices(actor, shown.actionId, shown.directionId, shown.frame);
  return indices ? { shown, indices } : null;
}

function readSelectionPlanes(project, actor, indices, rect) {
  const planes = [];
  for (let layer = 0; layer < actor.layers; layer += 1) {
    const pixels = [];
    for (let y = 0; y < rect.height; y += 1) {
      for (let x = 0; x < rect.width; x += 1) {
        pixels.push(readFramePixel(project, actor, indices, layer, rect.x + x, rect.y + y));
      }
    }
    planes.push({ mode: layerMode(actor, layer), pixels });
  }
  return planes;
}

function clearSelectionPixels(project, actor, indices, rect) {
  for (let layer = 0; layer < actor.layers; layer += 1) {
    for (let y = 0; y < rect.height; y += 1) {
      for (let x = 0; x < rect.width; x += 1) {
        writeFramePixel(project, actor, indices, layer, rect.x + x, rect.y + y, 0);
      }
    }
  }
}

function writeSelectionPlanes(project, actor, indices, origin, planes, width, height) {
  const layers = Math.min(actor.layers, planes.length);
  for (let layer = 0; layer < layers; layer += 1) {
    const pixels = planes[layer].pixels;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        writeFramePixel(project, actor, indices, layer, origin.x + x, origin.y + y, pixels[y * width + x]);
      }
    }
  }
}

export function copySpriteSelection(project, actor, pose, rect) {
  const live = poseIndices(actor, pose);
  const area = clipSpriteRect(actor, rect);
  if (!live || !area) return null;
  const planes = readSelectionPlanes(project, actor, live.indices, area);
  return {
    kind: SPRITE_FRAME_CLIPBOARD_KIND,
    width: area.width,
    height: area.height,
    layers: planes.length,
    planes,
  };
}

export function parseSpriteFrameClipboard(raw) {
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
  if (data.kind !== SPRITE_FRAME_CLIPBOARD_KIND) return null;
  const { width, height, layers } = data;
  const maxW = 8 * SPRITE_PIXEL_W;
  const maxH = 8 * SPRITE_PIXEL_H;
  if (!Number.isInteger(width) || !Number.isInteger(height) || !Number.isInteger(layers)) return null;
  if (width < 1 || height < 1 || width > maxW || height > maxH || (layers !== 1 && layers !== 2)) return null;
  if (!Array.isArray(data.planes) || data.planes.length !== layers) return null;
  const planes = [];
  for (const plane of data.planes) {
    if (!plane || (plane.mode !== "hires" && plane.mode !== "multi")) return null;
    if (!Array.isArray(plane.pixels) || plane.pixels.length !== width * height) return null;
    const pixels = [];
    for (const value of plane.pixels) {
      if (!Number.isInteger(value) || value < 0 || value > 3) return null;
      pixels.push(value);
    }
    planes.push({ mode: plane.mode, pixels });
  }
  return { kind: SPRITE_FRAME_CLIPBOARD_KIND, width, height, layers, planes };
}

export function snapshotPose(project, actor, pose) {
  const live = poseIndices(actor, pose);
  if (!live) return null;
  return live.indices.map((index) => ({ index, bytes: spriteBytes(project, index).slice() }));
}

export function restoreSpriteSnapshot(project, snapshots) {
  for (const shot of snapshots) spriteBytes(project, shot.index).set(shot.bytes);
}

export function pasteSpriteSelection(project, actor, pose, x, y, clip) {
  const source = parseSpriteFrameClipboard(clip);
  const live = poseIndices(actor, pose);
  if (!source || !live) return null;
  const frame = framePixelSize(actor);
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= frame.w || y >= frame.h) return null;
  const width = Math.min(source.width, frame.w - x);
  const height = Math.min(source.height, frame.h - y);
  const snapshots = snapshotPose(project, actor, pose);
  const planes = source.planes.map((plane) => {
    const pixels = [];
    for (let row = 0; row < height; row += 1) {
      for (let col = 0; col < width; col += 1) pixels.push(plane.pixels[row * source.width + col]);
    }
    return { mode: plane.mode, pixels };
  });
  writeSelectionPlanes(project, actor, live.indices, { x, y }, planes, width, height);
  const undo = snapshots.filter((shot) => !sameBytes(spriteBytes(project, shot.index), shot.bytes));
  if (!undo.length) return null;
  pushSpriteUndo(project, undo);
  return { x, y, width, height };
}

export function relocateSpriteSelection(project, actor, pose, rect, destX, destY) {
  const live = poseIndices(actor, pose);
  const area = clipSpriteRect(actor, rect);
  if (!live || !area) return null;
  const frame = framePixelSize(actor);
  const x = clamp(Math.trunc(destX), 0, frame.w - area.width);
  const y = clamp(Math.trunc(destY), 0, frame.h - area.height);
  if (x === area.x && y === area.y) return area;
  const planes = readSelectionPlanes(project, actor, live.indices, area);
  clearSelectionPixels(project, actor, live.indices, area);
  writeSelectionPlanes(project, actor, live.indices, { x, y }, planes, area.width, area.height);
  return { x, y, width: area.width, height: area.height };
}

export function moveSpriteSelection(project, actor, pose, rect, destX, destY) {
  const snapshots = snapshotPose(project, actor, pose);
  if (!snapshots) return null;
  const landed = relocateSpriteSelection(project, actor, pose, rect, destX, destY);
  if (!landed) return null;
  const undo = snapshots.filter((shot) => !sameBytes(spriteBytes(project, shot.index), shot.bytes));
  pushSpriteUndo(project, undo);
  return landed;
}

export function mirrorSpriteSelection(project, actor, pose, rect) {
  const live = poseIndices(actor, pose);
  const area = clipSpriteRect(actor, rect);
  if (!live || !area) return false;
  const snapshots = snapshotPose(project, actor, pose);
  const planes = readSelectionPlanes(project, actor, live.indices, area).map((plane) => {
    const pixels = [];
    for (let y = 0; y < area.height; y += 1) {
      for (let x = 0; x < area.width; x += 1) {
        pixels.push(plane.pixels[y * area.width + (area.width - 1 - x)]);
      }
    }
    return { mode: plane.mode, pixels };
  });
  writeSelectionPlanes(project, actor, live.indices, area, planes, area.width, area.height);
  const undo = snapshots.filter((shot) => !sameBytes(spriteBytes(project, shot.index), shot.bytes));
  pushSpriteUndo(project, undo);
  return undo.length > 0;
}

export function clearSpriteFrame(project, actor, pose) {
  const shown = shownPose(actor, pose);
  const indices = slotIndices(actor, shown.actionId, shown.directionId, shown.frame);
  if (!indices) return false;
  const undo = [];
  for (const index of indices) {
    const current = spriteBytes(project, index);
    if (current.every((value) => value === 0)) continue;
    undo.push({ index, bytes: current.slice() });
    current.fill(0);
  }
  pushSpriteUndo(project, undo);
  return undo.length > 0;
}

export function serializeSprites(project) {
  return {
    sprites: Array.from(project.sprites),
    actors: project.actors.map((actor) => ({
      id: actor.id,
      name: actor.name,
      kind: actor.kind,
      layers: actor.layers,
      stack: actor.stack,
      grid: { ...actor.grid },
      directions: actor.directions,
      actions: actor.actions.map((action) => ({ ...action })),
      nextActionId: actor.nextActionId,
      slots: JSON.parse(JSON.stringify(actor.slots)),
      colors: [...actor.colors],
      multi0: actor.multi0,
      multi1: actor.multi1,
      placement: actor.placement ? { ...actor.placement } : null,
    })),
    nextActorId: project.nextActorId,
  };
}

export function readSprites(data, project) {
  if (data.sprites == null && data.actors == null && data.nextActorId == null) return "";
  const sprites = data.sprites == null ? new Array(SPRITE_COUNT * SPRITE_BYTES).fill(0) : data.sprites;
  if (!Array.isArray(sprites) || sprites.length !== SPRITE_COUNT * SPRITE_BYTES) {
    return `Sprite data must be an array of ${SPRITE_COUNT * SPRITE_BYTES} numbers.`;
  }
  for (let i = 0; i < sprites.length; i += 1) {
    if (!isByte(sprites[i])) return `Sprite data entry ${i} must be an integer from 0 to 255.`;
  }
  if (data.actors != null && !Array.isArray(data.actors)) return "Actors must be a list.";
  const actors = [];
  const seenIds = new Set();
  const seenImages = new Set();
  for (const raw of data.actors || []) {
    const parsed = parseActor(raw, seenIds, seenImages);
    if (!parsed.ok) return parsed.error;
    actors.push(parsed.actor);
  }
  let nextActorId = data.nextActorId;
  if (!Number.isInteger(nextActorId) || nextActorId < 1) {
    nextActorId = actors.reduce((max, actor) => Math.max(max, Number(actor.id) || 0), 0) + 1;
  }
  project.sprites = Uint8Array.from(sprites);
  project.actors = actors;
  project.nextActorId = nextActorId;
  project.spriteUndo = [];
  return "";
}

function parseActor(raw, seenIds, seenImages) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("An actor must be an object.");
  if (typeof raw.id !== "string" || !raw.id) return fail("An actor is missing an id.");
  if (seenIds.has(raw.id)) return fail("Two actors share an id.");
  seenIds.add(raw.id);
  if (typeof raw.name !== "string" || !raw.name.trim()) return fail("An actor is missing a name.");
  if (raw.kind !== "player" && raw.kind !== "enemy" && raw.kind !== "action") {
    return fail("An actor kind must be player, enemy, or action.");
  }
  if (raw.layers !== 1 && raw.layers !== 2) return fail("An actor must have one or two layers.");
  if (raw.layers === 1 && raw.stack !== "single") return fail("A single-layer actor uses the single stack.");
  if (raw.layers === 2 && raw.stack !== "over-single" && raw.stack !== "over-multi") {
    return fail("A dual-layer actor must stack single-on-single or single-on-multi.");
  }
  const grid = raw.grid || {};
  if (!gridAllowed(raw.layers === 2, grid.width, grid.height)) {
    return fail("An actor uses a sprite grid the editor does not allow.");
  }
  const directions = directionSet(raw.directions);
  if (!directions) return fail("An actor has an unknown direction grid.");
  if (!Array.isArray(raw.actions) || raw.actions.length < 1) return fail("An actor needs at least one action.");
  const actions = [];
  const actionIds = new Set();
  for (const action of raw.actions) {
    const parsed = parseAction(action, actionIds);
    if (!parsed.ok) return parsed;
    actions.push(parsed.action);
  }
  if (!Number.isInteger(raw.nextActionId) || raw.nextActionId < 1) {
    return fail("An actor is missing its next action id.");
  }
  const per = grid.width * grid.height * raw.layers;
  const slots = {};
  for (const action of actions) {
    const block = raw.slots?.[action.id];
    if (!block || typeof block !== "object") return fail(`Action ${action.name} is missing its sprites.`);
    slots[action.id] = {};
    for (const direction of directionsFor(raw.directions, action.type)) {
      const frames = climbingFrames(block, action.type, direction.id);
      if (!Array.isArray(frames) || frames.length !== action.frames) {
        return fail(`Action ${action.name} is missing the ${direction.label} frames.`);
      }
      slots[action.id][direction.id] = [];
      for (const frame of frames) {
        if (!Array.isArray(frame) || frame.length !== per) {
          return fail(`Action ${action.name} has a frame of the wrong size.`);
        }
        const indices = [];
        for (const index of frame) {
          if (!Number.isInteger(index) || index < 0 || index >= SPRITE_COUNT) {
            return fail("A sprite image index is out of range.");
          }
          if (seenImages.has(index)) return fail("Two actor frames share a sprite image.");
          seenImages.add(index);
          indices.push(index);
        }
        slots[action.id][direction.id].push(indices);
      }
    }
  }
  const colorCount = grid.width * grid.height * raw.layers;
  if (!Array.isArray(raw.colors) || raw.colors.length !== colorCount) {
    return fail("An actor is missing a color for each sprite.");
  }
  for (const color of raw.colors) {
    if (!Number.isInteger(color) || color < 0 || color > 15) return fail("A sprite color must be from 0 to 15.");
  }
  if (!isColor(raw.multi0) || !isColor(raw.multi1)) return fail("Multicolor registers must be from 0 to 15.");
  let placement = null;
  if (raw.placement != null) {
    placement = parsePlacement(raw.placement, actions, directions);
    if (!placement.ok) return placement;
    placement = placement.placement;
  }
  return {
    ok: true,
    actor: {
      id: raw.id,
      name: raw.name.trim(),
      kind: raw.kind,
      layers: raw.layers,
      stack: raw.stack,
      grid: { width: grid.width, height: grid.height },
      directions: raw.directions,
      actions,
      nextActionId: raw.nextActionId,
      slots,
      colors: [...raw.colors],
      multi0: raw.multi0,
      multi1: raw.multi1,
      placement,
    },
  };
}

function parseAction(action, actionIds) {
  if (!action || typeof action !== "object") return fail("An action must be an object.");
  if (typeof action.id !== "string" || !action.id) return fail("An action is missing an id.");
  if (actionIds.has(action.id)) return fail("Two actions share an id.");
  actionIds.add(action.id);
  const known = ACTION_PRESETS.some((preset) => preset.type === action.type);
  if (action.type !== "custom" && !known) return fail("An action type is unknown.");
  if (typeof action.name !== "string" || !action.name.trim()) return fail("An action is missing a name.");
  if (!Number.isInteger(action.frames) || action.frames < 1 || action.frames > FRAME_MAX) {
    return fail("An action has a frame count the editor cannot store.");
  }
  if (!Number.isInteger(action.interval) || action.interval < 20 || action.interval > 5000) {
    return fail("An action has a frame time the editor cannot store.");
  }
  return {
    ok: true,
    action: {
      id: action.id,
      type: action.type,
      name: action.name.trim(),
      frames: action.frames,
      interval: action.interval,
    },
  };
}

function climbingFrames(block, actionType, directionId) {
  if (Array.isArray(block[directionId])) return block[directionId];
  if (actionType === "climbing" && directionId === "climb") {
    if (Array.isArray(block.left)) return block.left;
    if (Array.isArray(block.right)) return block.right;
  }
  return null;
}

function parsePlacement(raw, actions, directions) {
  if (!raw || typeof raw !== "object") return fail("A placement must be an object.");
  if (!Number.isInteger(raw.x) || !Number.isInteger(raw.y)) return fail("A placement needs whole-pixel coordinates.");
  if (raw.x < -4096 || raw.y < -4096 || raw.x > 4096 || raw.y > 4096) {
    return fail("A placement is outside the screen.");
  }
  if (!actions.some((action) => action.id === raw.actionId)) return fail("A placement points at a missing action.");
  const known = new Set();
  for (const action of actions) {
    for (const cell of directionsFor(directions.id, action.type)) known.add(cell.id);
  }
  if (!known.has(raw.directionId)) {
    return fail("A placement points at a missing direction.");
  }
  const action = actions.find((entry) => entry.id === raw.actionId);
  if (!Number.isInteger(raw.frame) || raw.frame < 0 || raw.frame >= action.frames) {
    return fail("A placement points at a missing frame.");
  }
  return {
    ok: true,
    placement: {
      x: raw.x,
      y: raw.y,
      actionId: raw.actionId,
      directionId: raw.directionId,
      frame: raw.frame,
    },
  };
}

function normalizeActions(list) {
  if (!Array.isArray(list) || list.length < 1) return fail("Add at least one action.");
  const actions = [];
  const types = new Set();
  const names = new Set();
  for (const entry of list) {
    const type = entry?.type === "custom" ? "custom" : entry?.type;
    const preset = ACTION_PRESETS.find((item) => item.type === type);
    if (type !== "custom" && !preset) return fail("Choose an action type.");
    if (type !== "custom" && types.has(type)) return fail(`${preset.name} is listed twice.`);
    types.add(type);
    const name = type === "custom" ? cleanName(entry.name) : preset.name;
    if (!name) return fail("Type a name for the custom action.");
    if (names.has(name.toLowerCase())) return fail("Two actions share a name.");
    names.add(name.toLowerCase());
    actions.push({
      id: String(actions.length + 1),
      type,
      name,
      frames: clampFrames(entry.frames, type === "custom" ? 1 : preset.frames),
      interval: 180,
    });
  }
  return { ok: true, actions };
}

function clampFrames(value, fallback) {
  const frames = Number.isInteger(value) ? value : fallback;
  return Math.min(FRAME_MAX, Math.max(1, frames));
}

function cleanName(value) {
  return String(value || "").trim().slice(0, 32);
}

function nextName(project, kind) {
  const label = KIND_LABEL[kind];
  const used = new Set(project.actors.filter((actor) => actor.kind === kind).map((actor) => actor.name));
  let n = 1;
  while (used.has(`${label} ${n}`)) n += 1;
  return `${label} ${n}`;
}

function defaultColors(gridW, gridH, layers) {
  const colors = [];
  for (let layer = 0; layer < layers; layer += 1) {
    for (let y = 0; y < gridH; y += 1) {
      for (let x = 0; x < gridW; x += 1) {
        colors.push(INK_CYCLE[(y * gridW + x + layer * 3) % INK_CYCLE.length]);
      }
    }
  }
  return colors;
}

function fillSlots(actor, allocated) {
  let cursor = 0;
  const per = cellCount(actor) * actor.layers;
  for (const action of actor.actions) {
    actor.slots[action.id] = {};
    for (const direction of directionsFor(actor.directions, action.type)) {
      actor.slots[action.id][direction.id] = [];
      for (let frame = 0; frame < action.frames; frame += 1) {
        actor.slots[action.id][direction.id].push(allocated.slice(cursor, cursor + per));
        cursor += per;
      }
    }
  }
}

function usedSpriteIndices(project) {
  const used = new Set();
  for (const actor of project.actors) {
    for (const index of collectIndices(actor)) used.add(index);
  }
  return used;
}

function collectIndices(actor) {
  const indices = [];
  for (const action of actor.actions) indices.push(...collectActionIndices(actor, action.id));
  return indices;
}

function collectActionIndices(actor, actionId) {
  const indices = [];
  const block = actor.slots[actionId] || {};
  for (const frames of Object.values(block)) {
    for (const frame of frames) indices.push(...frame);
  }
  return indices;
}

function takeSprites(project, count) {
  const used = usedSpriteIndices(project);
  const indices = [];
  for (let index = 0; index < SPRITE_COUNT && indices.length < count; index += 1) {
    if (!used.has(index)) indices.push(index);
  }
  for (const index of indices) spriteBytes(project, index).fill(0);
  return indices;
}

function releaseSprites(project, indices) {
  for (const index of indices) spriteBytes(project, index).fill(0);
}

function applyTemplates(project, actor, onlyActionId) {
  for (const action of actor.actions) {
    if (onlyActionId && action.id !== onlyActionId) continue;
    if (action.type === "custom") continue;
    for (const direction of directionsFor(actor.directions, action.type)) {
      for (let frame = 0; frame < action.frames; frame += 1) {
        stampTemplate(project, actor, action, direction.id, frame);
      }
    }
  }
}

function stampTemplate(project, actor, action, directionId, frame) {
  const mask = renderTemplate(actor, action, directionId, frame);
  const indices = actor.slots[action.id][directionId][frame];
  const { width, height } = actor.grid;
  const destW = width * SPRITE_PIXEL_W;
  for (let layer = 0; layer < actor.layers; layer += 1) {
    const mode = layerMode(actor, layer);
    for (let gy = 0; gy < height; gy += 1) {
      for (let gx = 0; gx < width; gx += 1) {
        const bytes = spriteBytes(project, indices[(layer * height + gy) * width + gx]);
        bytes.fill(0);
        const shadow = layer === 0 && actor.layers === 2 && actor.stack === "over-single";
        for (let ly = 0; ly < SPRITE_PIXEL_H; ly += 1) {
          for (let lx = 0; lx < SPRITE_PIXEL_W; lx += 1) {
            const sx = gx * SPRITE_PIXEL_W + lx - (shadow ? 1 : 0);
            const sy = gy * SPRITE_PIXEL_H + ly - (shadow ? 1 : 0);
            if (sx < 0 || sy < 0 || sx >= destW || sy >= actor.grid.height * SPRITE_PIXEL_H) continue;
            if (!mask[sy * destW + sx]) continue;
            if (mode === "hires") setSpritePixel(bytes, "hires", lx, ly, 1);
            else setSpritePixel(bytes, "multi", lx >> 1, ly, multiTemplateValue(lx, ly));
          }
        }
      }
    }
  }
}

function multiTemplateValue(x, y) {
  if ((x + y) % 7 === 0) return 1;
  if (x % 5 === 0) return 3;
  return 2;
}

function renderTemplate(actor, action, directionId, frame) {
  const base = new Uint8Array(SPRITE_PIXEL_W * SPRITE_PIXEL_H);
  drawPose((x, y) => {
    if (x >= 0 && y >= 0 && x < SPRITE_PIXEL_W && y < SPRITE_PIXEL_H) base[y * SPRITE_PIXEL_W + x] = 1;
  }, action.type, directionId, frame, action.frames);
  const scale = Math.min(actor.grid.width, actor.grid.height);
  const destW = actor.grid.width * SPRITE_PIXEL_W;
  const destH = actor.grid.height * SPRITE_PIXEL_H;
  const ox = Math.floor((destW - SPRITE_PIXEL_W * scale) / 2);
  const oy = Math.floor((destH - SPRITE_PIXEL_H * scale) / 2);
  const dest = new Uint8Array(destW * destH);
  for (let y = 0; y < SPRITE_PIXEL_H; y += 1) {
    for (let x = 0; x < SPRITE_PIXEL_W; x += 1) {
      if (!base[y * SPRITE_PIXEL_W + x]) continue;
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          dest[(oy + y * scale + sy) * destW + (ox + x * scale + sx)] = 1;
        }
      }
    }
  }
  return dest;
}

function drawPose(plot, type, directionId, frame, frames) {
  const view = poseView(directionId);
  const mirror = view === "side" && facingSign(directionId) < 0;
  const p = (x, y) => plot(mirror ? 22 - x : x, y);
  if (view === "front") drawFront(p, type, frame, frames);
  else if (view === "back") drawBack(p, type, frame, frames);
  else drawSide(p, type, frame, frames);
}

function poseView(directionId) {
  if (directionId === "n" || directionId === "up") return "back";
  if (directionId === "s" || directionId === "down" || directionId === "idle" || directionId === "climb") return "front";
  return "side";
}

function facingSign(directionId) {
  if (directionId === "e" || directionId === "ne" || directionId === "se" || directionId === "right") return 1;
  return -1;
}

function phase(frame, frames, steps) {
  if (frames <= 1) return 0;
  return frame % steps;
}

function drawSide(plot, type, frame, frames) {
  const step = phase(frame, frames, type === "walking" ? 3 : type === "climbing" ? 2 : 1);
  if (type === "falling") {
    circle(plot, 5, 10, 2);
    line(plot, 7, 10, 15, 10);
    line(plot, 15, 10, 20, 7);
    line(plot, 15, 10, 20, 14);
    line(plot, 9, 10, 7, 6);
    line(plot, 9, 10, 7, 15);
    return;
  }
  if (type === "hit") {
    circle(plot, 8, 6, 2);
    line(plot, 9, 8, 15, 13);
    line(plot, 11, 10, 6, 7);
    line(plot, 12, 11, 18, 9);
    line(plot, 15, 13, 12, 20);
    line(plot, 15, 13, 19, 19);
    return;
  }
  circle(plot, 10, 4, 2);
  line(plot, 10, 6, 10, 12);
  if (type === "jumping") {
    line(plot, 10, 8, 5, 4);
    line(plot, 10, 8, 16, 5);
    line(plot, 10, 12, 6, 16);
    line(plot, 10, 12, 15, 16);
    return;
  }
  if (type === "climbing") {
    if (step % 2 === 0) {
      line(plot, 10, 7, 10, 1);
      line(plot, 10, 9, 6, 13);
      line(plot, 10, 12, 8, 20);
      line(plot, 10, 12, 14, 18);
    } else {
      line(plot, 10, 7, 6, 3);
      line(plot, 10, 8, 14, 2);
      line(plot, 10, 12, 7, 18);
      line(plot, 10, 12, 15, 20);
    }
    return;
  }
  if (type === "shooting") {
    line(plot, 10, 8, 21, 8);
    line(plot, 10, 9, 7, 13);
    line(plot, 10, 12, 8, 20);
    line(plot, 10, 12, 13, 20);
    return;
  }
  if (step === 1) {
    line(plot, 10, 7, 7, 12);
    line(plot, 10, 7, 14, 12);
    line(plot, 10, 12, 9, 20);
    line(plot, 10, 12, 12, 20);
  } else if (step === 2) {
    line(plot, 10, 7, 5, 10);
    line(plot, 10, 7, 15, 12);
    line(plot, 10, 12, 6, 19);
    line(plot, 10, 12, 16, 20);
  } else {
    line(plot, 10, 7, 6, 12);
    line(plot, 10, 7, 16, 9);
    line(plot, 10, 12, 6, 20);
    line(plot, 10, 12, 15, 18);
  }
}

function drawFront(plot, type, frame, frames) {
  const step = phase(frame, frames, type === "walking" ? 3 : type === "climbing" ? 2 : 1);
  if (type === "falling") {
    circle(plot, 6, 9, 2, [[5, 9], [7, 9]]);
    line(plot, 8, 9, 16, 11);
    line(plot, 16, 11, 21, 8);
    line(plot, 16, 11, 21, 15);
    return;
  }
  circle(plot, 12, 4, 2, [[11, 4], [13, 4]]);
  line(plot, 12, 6, 12, 12);
  if (type === "jumping") {
    line(plot, 12, 8, 7, 3);
    line(plot, 12, 8, 17, 3);
    line(plot, 12, 12, 8, 16);
    line(plot, 12, 12, 16, 16);
    return;
  }
  if (type === "climbing") {
    line(plot, 12, 7, step % 2 === 0 ? 8 : 12, 1);
    line(plot, 12, 8, step % 2 === 0 ? 16 : 12, 2);
    line(plot, 12, 12, 9, 20);
    line(plot, 12, 12, 15, 19);
    return;
  }
  if (type === "shooting") {
    line(plot, 12, 8, 21, 8);
    line(plot, 12, 9, 8, 12);
    line(plot, 12, 12, 9, 20);
    line(plot, 12, 12, 15, 20);
    return;
  }
  if (type === "hit") {
    line(plot, 12, 8, 7, 6);
    line(plot, 12, 8, 18, 7);
    line(plot, 12, 12, 9, 20);
    line(plot, 12, 12, 16, 18);
    return;
  }
  const spread = step === 1 ? 1 : 4;
  line(plot, 12, 8, 12 - (step === 2 ? 6 : 4), 12);
  line(plot, 12, 8, 12 + (step === 0 ? 6 : 4), 11);
  line(plot, 12, 12, 12 - spread, 20);
  line(plot, 12, 12, 12 + spread, 20);
}

function drawBack(plot, type, frame, frames) {
  const step = phase(frame, frames, type === "walking" ? 3 : type === "climbing" ? 2 : 1);
  circle(plot, 12, 4, 2);
  line(plot, 12, 6, 12, 12);
  if (type === "jumping") {
    line(plot, 12, 8, 7, 3);
    line(plot, 12, 8, 17, 3);
    line(plot, 12, 12, 8, 16);
    line(plot, 12, 12, 16, 16);
    return;
  }
  if (type === "climbing") {
    line(plot, 12, 7, 12, 1);
    line(plot, 12, 8, step % 2 === 0 ? 7 : 17, 3);
    line(plot, 12, 12, 9, 20);
    line(plot, 12, 12, 15, 18);
    return;
  }
  if (type === "shooting") {
    line(plot, 12, 8, 4, 8);
    line(plot, 12, 9, 16, 12);
    line(plot, 12, 12, 9, 20);
    line(plot, 12, 12, 15, 20);
    return;
  }
  if (type === "falling") {
    circle(plot, 18, 10, 2);
    line(plot, 16, 10, 8, 10);
    line(plot, 8, 10, 4, 7);
    line(plot, 8, 10, 4, 14);
    return;
  }
  if (type === "hit") {
    line(plot, 12, 8, 6, 6);
    line(plot, 12, 8, 18, 8);
    line(plot, 12, 12, 8, 19);
    line(plot, 12, 12, 17, 19);
    return;
  }
  const spread = step === 1 ? 1 : 4;
  line(plot, 12, 8, 7, 12);
  line(plot, 12, 8, 17, 12);
  line(plot, 12, 12, 12 - spread, 20);
  line(plot, 12, 12, 12 + spread, 20);
}

function circle(plot, cx, cy, radius, holes = []) {
  const skip = new Set(holes.map(([x, y]) => `${x},${y}`));
  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      if (x * x + y * y > radius * radius + 1) continue;
      const px = cx + x;
      const py = cy + y;
      if (skip.has(`${px},${py}`)) continue;
      plot(px, py);
    }
  }
}

function line(plot, x0, y0, x1, y1) {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const tx = Math.round(x1);
  const ty = Math.round(y1);
  const dx = Math.abs(tx - x);
  const dy = Math.abs(ty - y);
  const sx = x < tx ? 1 : -1;
  const sy = y < ty ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    plot(x, y);
    if (x === tx && y === ty) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isByte(value) {
  return Number.isInteger(value) && value >= 0 && value <= 255;
}

function isColor(value) {
  return Number.isInteger(value) && value >= 0 && value <= 15;
}

function fail(error) {
  return { ok: false, error };
}
