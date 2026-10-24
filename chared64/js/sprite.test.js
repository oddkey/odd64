import assert from "node:assert/strict";
import test from "node:test";
import { parseProject, serializeProject } from "./files.js";
import { createBlankProject, sameBytes } from "./project.js";
import {
  SPRITE_COUNT,
  acceptsPaint,
  addActorAction,
  cellColor,
  clearSpriteFrame,
  createActor,
  directionForKey,
  getSpritePixel,
  gridChoices,
  imagesUsed,
  copySpriteSelection,
  displayPose,
  moveActor,
  moveSpriteSelection,
  parseSpriteFrameClipboard,
  pasteSpriteSelection,
  placeActor,
  setActionFrames,
  setSpritePixel,
  spriteBytes,
  undoSprite,
} from "./sprites.js";

function actorSpec(overrides = {}) {
  return {
    kind: "player",
    layers: 1,
    stack: "single",
    gridW: 1,
    gridH: 1,
    directions: "horizontal",
    actions: [{ type: "walking", name: "Walking", frames: 3 }],
    template: true,
    ...overrides,
  };
}

test("sprite canvas zoom keeps the larger sizes", () => {
  const project = createBlankProject();
  project.zoom.sprites = 32;
  const parsed = parseProject(serializeProject(project));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.project.zoom.sprites, 32);
  project.zoom.sprites = 64;
  assert.equal(parseProject(serializeProject(project)).project.zoom.sprites, 64);
  project.zoom.sprites = 20;
  assert.equal(parseProject(serializeProject(project)).ok, false);
});

test("sprite grids stay inside the hardware sprite limit", () => {
  const single = gridChoices(false);
  const dual = gridChoices(true);
  assert.equal(single[0].w, 1);
  assert.equal(single[0].h, 1);
  assert.ok(single.every((choice) => choice.w * choice.h <= 8));
  assert.ok(single.some((choice) => choice.w === 8 && choice.h === 1));
  assert.ok(single.some((choice) => choice.w === 1 && choice.h === 8));
  assert.ok(single.some((choice) => choice.w === 4 && choice.h === 2));
  assert.ok(single.some((choice) => choice.w === 2 && choice.h === 4));
  assert.equal(single.filter((choice) => choice.w === 3 && choice.h === 3).length, 0);
  assert.equal(dual[0].w, 1);
  assert.equal(dual[0].h, 1);
  assert.ok(dual.every((choice) => choice.w * choice.h <= 4));
  assert.ok(dual.some((choice) => choice.w === 2 && choice.h === 2));
  assert.equal(dual.filter((choice) => choice.w === 8).length, 0);
});

test("direction keys follow the chosen grid", () => {
  assert.equal(directionForKey("all", "ArrowUp"), "n");
  assert.equal(directionForKey("all", "ArrowLeft"), "w");
  assert.equal(directionForKey("cardinal", "ArrowDown"), "down");
  assert.equal(directionForKey("horizontal", "ArrowLeft"), "left");
  assert.equal(directionForKey("horizontal", "ArrowUp"), null);
  assert.equal(directionForKey("vertical", "ArrowUp"), "up");
  assert.equal(directionForKey("vertical", "ArrowRight"), null);
});

test("a template actor allocates sprite images and keeps extra frames blank", () => {
  const project = createBlankProject();
  const created = createActor(project, actorSpec());
  assert.equal(created.ok, true);
  const actor = created.actor;
  assert.equal(actor.name, "Player 1");
  assert.equal(imagesUsed(project), 6);
  const walking = actor.actions[0];
  const first = actor.slots[walking.id].left[0][0];
  const second = actor.slots[walking.id].left[1][0];
  assert.equal(sameBytes(spriteBytes(project, first), spriteBytes(project, second)), false);
  assert.ok(spriteBytes(project, first).some((value) => value !== 0));
  const added = setActionFrames(project, actor, walking.id, 4);
  assert.equal(added.ok, true);
  const blank = actor.slots[walking.id].right[3][0];
  assert.ok(spriteBytes(project, blank).every((value) => value === 0));
  assert.equal(imagesUsed(project), 8);
});

test("a tall actor paints each sprite only in its own color", () => {
  const project = createBlankProject();
  const created = createActor(project, actorSpec({
    gridW: 1,
    gridH: 2,
    template: false,
    actions: [{ type: "walking", name: "Walking", frames: 1 }],
  }));
  const actor = created.actor;
  assert.equal(cellColor(actor, 0, 0, 0), 14);
  assert.equal(cellColor(actor, 0, 1, 0), 2);
  assert.equal(acceptsPaint(actor, 0, 0, 0, { kind: "ink", color: 14 }), true);
  assert.equal(acceptsPaint(actor, 0, 1, 0, { kind: "ink", color: 14 }), false);
  assert.equal(acceptsPaint(actor, 0, 1, 0, { kind: "ink", color: 2 }), true);
  assert.equal(acceptsPaint(actor, 0, 0, 0, { kind: "clear" }), true);
  const index = actor.slots[actor.actions[0].id].left[0][0];
  const bytes = spriteBytes(project, index);
  assert.equal(setSpritePixel(bytes, "hires", 0, 0, 1), true);
  assert.equal(getSpritePixel(bytes, "hires", 0, 0), 1);
  assert.equal(setSpritePixel(bytes, "hires", 0, 0, 1), false);
});

test("dual-layer actors default to a single-color sprite over a multicolor sprite", () => {
  const project = createBlankProject();
  const created = createActor(project, actorSpec({
    layers: 2,
    stack: "over-multi",
    directions: "cardinal",
    actions: [{ type: "jumping", name: "Jumping", frames: 1 }],
  }));
  assert.equal(created.ok, true);
  const actor = created.actor;
  assert.equal(actor.layers, 2);
  assert.equal(actor.stack, "over-multi");
  assert.equal(imagesUsed(project), 8);
  const top = actor.slots[actor.actions[0].id].up[0][1];
  const bottom = actor.slots[actor.actions[0].id].up[0][0];
  assert.equal(getSpritePixel(spriteBytes(project, top), "hires", 12, 4), 1);
  assert.ok(spriteBytes(project, bottom).some((value) => value !== 0));
});

test("creation stops when the 256 sprite images are full", () => {
  const project = createBlankProject();
  const created = createActor(project, actorSpec({
    gridW: 8,
    gridH: 1,
    directions: "all",
    actions: [
      { type: "walking", name: "Walking", frames: 3 },
      { type: "jumping", name: "Jumping", frames: 1 },
      { type: "climbing", name: "Climbing", frames: 2 },
    ],
    template: false,
  }));
  assert.equal(created.ok, false);
  assert.match(created.error, /256/);
  assert.equal(project.actors.length, 0);
});

test("climbing does not require left or right poses", () => {
  const project = createBlankProject();
  const created = createActor(project, actorSpec({
    template: false,
    directions: "horizontal",
    actions: [
      { type: "walking", name: "Walking", frames: 3 },
      { type: "climbing", name: "Climbing", frames: 2 },
    ],
  }));
  assert.equal(created.ok, true);
  const actor = created.actor;
  const climbing = actor.actions.find((action) => action.type === "climbing");
  assert.equal(actor.slots[climbing.id].left, undefined);
  assert.equal(actor.slots[climbing.id].right, undefined);
  assert.equal(actor.slots[climbing.id].climb.length, 2);
  assert.equal(actor.slots[actor.actions[0].id].left.length, 3);
  assert.equal(imagesUsed(project), 8);
  const pose = displayPose(actor, {
    spritePose: { actorId: actor.id, actionId: climbing.id, directionId: "left", frame: 1 },
  });
  assert.equal(pose.actionId, climbing.id);
  assert.equal(pose.directionId, "climb");
  assert.equal(pose.frame, 1);
  const cardinal = createActor(project, actorSpec({
    template: false,
    directions: "cardinal",
    actions: [{ type: "climbing", name: "Climbing", frames: 2 }],
  })).actor;
  const cardClimb = cardinal.actions[0];
  assert.equal(cardinal.slots[cardClimb.id].up.length, 2);
  assert.equal(cardinal.slots[cardClimb.id].down.length, 2);
  assert.equal(cardinal.slots[cardClimb.id].left, undefined);
  assert.equal(cardinal.slots[cardClimb.id].right, undefined);
  const parsed = parseProject(serializeProject(project));
  assert.equal(parsed.ok, true);
  const saved = parsed.project.actors[0].actions.find((action) => action.type === "climbing");
  assert.equal(parsed.project.actors[0].slots[saved.id].climb.length, 2);
  assert.equal(parsed.project.actors[0].slots[saved.id].left, undefined);
});

test("cursor movement uses the direction animation and stays on the screen", () => {
  const project = createBlankProject();
  const actor = createActor(project, actorSpec()).actor;
  placeActor(actor, 16, 40, null);
  const pose = moveActor(project, actor, "ArrowRight", null);
  assert.equal(pose.directionId, "right");
  assert.equal(pose.frame, 0);
  assert.equal(actor.placement.x, 20);
  const next = moveActor(project, actor, "ArrowRight", pose);
  assert.equal(next.frame, 1);
  assert.equal(moveActor(project, actor, "ArrowUp", pose), null);
  project.tileWidth = 2;
  project.tileHeight = 2;
  actor.placement.x = 8;
  const blocked = moveActor(project, actor, "ArrowRight", next);
  assert.equal(blocked.directionId, "right");
  assert.ok(actor.placement.x <= project.tileWidth * 8 - 8);
});

test("custom actions and sprite colors round-trip through the project file", () => {
  const project = createBlankProject();
  const actor = createActor(project, actorSpec({ template: false, directions: "vertical" })).actor;
  const added = addActorAction(project, actor, { type: "custom", name: "Wave", frames: 2, template: false });
  assert.equal(added.ok, true);
  actor.colors[0] = 4;
  actor.multi0 = 5;
  spriteBytes(project, actor.slots[actor.actions[0].id].up[0][0])[0] = 129;
  const parsed = parseProject(serializeProject(project));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.project.actors.length, 1);
  assert.equal(parsed.project.actors[0].actions[1].name, "Wave");
  assert.equal(parsed.project.actors[0].colors[0], 4);
  assert.equal(parsed.project.zoom.sprites, 8);
  assert.equal(parsed.project.sprites[actor.slots[actor.actions[0].id].up[0][0] * 64], 129);
  assert.equal(imagesUsed(parsed.project), imagesUsed(project));

  const legacy = serializeProject(createBlankProject());
  delete legacy.sprites;
  delete legacy.actors;
  delete legacy.nextActorId;
  delete legacy.zoom.sprites;
  const old = parseProject(legacy);
  assert.equal(old.ok, true);
  assert.equal(old.project.actors.length, 0);
  assert.equal(old.project.sprites.length, SPRITE_COUNT * 64);
  assert.equal(old.project.zoom.sprites, 8);
});

test("clearing a sprite frame blanks that frame and undoes", () => {
  const project = createBlankProject();
  const actor = createActor(project, actorSpec({ template: false, gridW: 2 })).actor;
  const action = actor.actions[0];
  const cells = actor.slots[action.id].left[0];
  spriteBytes(project, cells[0])[0] = 9;
  spriteBytes(project, cells[1])[4] = 8;
  const other = spriteBytes(project, actor.slots[action.id].left[1][0]);
  other[0] = 3;
  const pose = { actorId: actor.id, actionId: action.id, directionId: "left", frame: 0 };
  assert.equal(clearSpriteFrame(project, actor, pose), true);
  assert.ok(spriteBytes(project, cells[0]).every((value) => value === 0));
  assert.ok(spriteBytes(project, cells[1]).every((value) => value === 0));
  assert.equal(other[0], 3);
  assert.equal(clearSpriteFrame(project, actor, pose), false);
  assert.equal(undoSprite(project), true);
  assert.equal(spriteBytes(project, cells[0])[0], 9);
  assert.equal(spriteBytes(project, cells[1])[4], 8);
});

test("a sprite selection copies onto another frame and undoes", () => {
  const project = createBlankProject();
  const actor = createActor(project, actorSpec({ template: false })).actor;
  const action = actor.actions[0];
  const source = spriteBytes(project, actor.slots[action.id].left[0][0]);
  setSpritePixel(source, "hires", 1, 2, 1);
  setSpritePixel(source, "hires", 4, 2, 1);
  const pose = { actorId: actor.id, actionId: action.id, directionId: "left", frame: 0 };
  const rect = { x: 1, y: 2, width: 2, height: 1 };
  const clip = copySpriteSelection(project, actor, pose, rect);
  const round = parseSpriteFrameClipboard(JSON.stringify(clip));
  assert.equal(round.width, 2);
  assert.equal(round.height, 1);
  assert.equal(round.layers, 1);
  assert.deepEqual(round.planes[0].pixels, [1, 0]);
  const dest = spriteBytes(project, actor.slots[action.id].right[2][0]);
  setSpritePixel(dest, "hires", 3, 2, 1);
  const before = dest.slice();
  const target = { actorId: actor.id, actionId: action.id, directionId: "right", frame: 2 };
  assert.deepEqual(pasteSpriteSelection(project, actor, target, rect.x, rect.y, round), rect);
  assert.equal(getSpritePixel(dest, "hires", 1, 2), 1);
  assert.equal(getSpritePixel(dest, "hires", 2, 2), 0);
  assert.equal(getSpritePixel(dest, "hires", 3, 2), 1);
  assert.equal(getSpritePixel(dest, "hires", 4, 2), 0);
  assert.equal(pasteSpriteSelection(project, actor, target, rect.x, rect.y, round), null);
  assert.equal(undoSprite(project), true);
  assert.ok(sameBytes(dest, before));
  assert.equal(getSpritePixel(source, "hires", 1, 2), 1);
  assert.equal(getSpritePixel(source, "hires", 4, 2), 1);
  assert.equal(copySpriteSelection(project, actor, pose, null), null);
});

test("selection copy and move cover every layer and can cross sprites", () => {
  const project = createBlankProject();
  const actor = createActor(project, actorSpec({ gridW: 2, layers: 2, stack: "over-single", template: false })).actor;
  const action = actor.actions[0];
  const cells = actor.slots[action.id].left[0];
  const pose = { actorId: actor.id, actionId: action.id, directionId: "left", frame: 0 };
  setSpritePixel(spriteBytes(project, cells[0]), "hires", 23, 0, 1);
  setSpritePixel(spriteBytes(project, cells[1]), "hires", 0, 0, 1);
  setSpritePixel(spriteBytes(project, cells[2]), "hires", 23, 0, 1);
  setSpritePixel(spriteBytes(project, cells[2]), "hires", 0, 4, 1);
  const rect = { x: 23, y: 0, width: 2, height: 1 };
  const clip = copySpriteSelection(project, actor, pose, rect);
  assert.equal(clip.width, 2);
  assert.equal(clip.layers, 2);
  assert.equal(clip.planes.length, 2);
  assert.deepEqual(clip.planes[0].pixels, [1, 1]);
  assert.deepEqual(clip.planes[1].pixels, [1, 0]);
  const narrow = createActor(project, actorSpec({ template: false })).actor;
  const narrowPose = { actorId: narrow.id, actionId: narrow.actions[0].id, directionId: "left", frame: 1 };
  const narrowBytes = spriteBytes(project, narrow.slots[narrow.actions[0].id].left[1][0]);
  setSpritePixel(narrowBytes, "hires", 5, 0, 1);
  assert.deepEqual(pasteSpriteSelection(project, narrow, narrowPose, 0, 0, clip), { x: 0, y: 0, width: 2, height: 1 });
  assert.equal(getSpritePixel(narrowBytes, "hires", 0, 0), 1);
  assert.equal(getSpritePixel(narrowBytes, "hires", 1, 0), 1);
  assert.equal(getSpritePixel(narrowBytes, "hires", 5, 0), 1);
  assert.equal(parseSpriteFrameClipboard({ kind: clip.kind, width: 1, height: 1, layers: 1, cells: [] }), null);
  assert.equal(parseSpriteFrameClipboard("nope"), null);

  const landed = moveSpriteSelection(project, actor, pose, rect, 25, 0);
  assert.deepEqual(landed, { x: 25, y: 0, width: 2, height: 1 });
  assert.equal(getSpritePixel(spriteBytes(project, cells[0]), "hires", 23, 0), 0);
  assert.equal(getSpritePixel(spriteBytes(project, cells[1]), "hires", 0, 0), 0);
  assert.equal(getSpritePixel(spriteBytes(project, cells[1]), "hires", 1, 0), 1);
  assert.equal(getSpritePixel(spriteBytes(project, cells[1]), "hires", 2, 0), 1);
  assert.equal(getSpritePixel(spriteBytes(project, cells[2]), "hires", 23, 0), 0);
  assert.equal(getSpritePixel(spriteBytes(project, cells[2]), "hires", 0, 4), 1);
  assert.equal(getSpritePixel(spriteBytes(project, cells[3]), "hires", 1, 0), 1);
  assert.equal(undoSprite(project), true);
  assert.equal(getSpritePixel(spriteBytes(project, cells[0]), "hires", 23, 0), 1);
  assert.equal(getSpritePixel(spriteBytes(project, cells[1]), "hires", 0, 0), 1);
  assert.equal(getSpritePixel(spriteBytes(project, cells[3]), "hires", 1, 0), 0);
  const depth = project.spriteUndo.length;
  assert.deepEqual(moveSpriteSelection(project, actor, pose, rect, rect.x, 0), rect);
  assert.equal(project.spriteUndo.length, depth);
  const edge = moveSpriteSelection(project, actor, pose, rect, 100, 0);
  assert.deepEqual(edge, { x: 46, y: 0, width: 2, height: 1 });
  assert.equal(getSpritePixel(spriteBytes(project, cells[0]), "hires", 23, 0), 0);
  assert.equal(getSpritePixel(spriteBytes(project, cells[1]), "hires", 22, 0), 1);
  assert.equal(getSpritePixel(spriteBytes(project, cells[1]), "hires", 23, 0), 1);
  assert.equal(getSpritePixel(spriteBytes(project, cells[3]), "hires", 22, 0), 1);
});
