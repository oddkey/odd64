import assert from "node:assert/strict";
import test from "node:test";
import { parseProject, serializeProject } from "./files.js";
import { createBlankProject, sameBytes } from "./project.js";
import {
  SPRITE_COUNT,
  acceptsPaint,
  addActorAction,
  cellColor,
  createActor,
  directionForKey,
  getSpritePixel,
  gridChoices,
  imagesUsed,
  moveActor,
  placeActor,
  setActionFrames,
  setSpritePixel,
  spriteBytes,
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
