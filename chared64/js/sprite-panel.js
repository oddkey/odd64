import { C64_COLORS, C64_NAMES } from "./colors.js";
import { bindTap, touchUsesTap } from "./gesture.js";
import { sameBytes } from "./project.js";
import { drawHardwareSprite, prepareCanvas } from "./render.js";
import {
  ACTION_PRESETS,
  DIRECTION_SETS,
  SPRITE_COUNT,
  SPRITE_ZOOMS,
  acceptsPaint,
  actorById,
  addActorAction,
  cellColor,
  clearPlacement,
  createActor,
  deleteActor,
  directionSet,
  displayPose,
  eachVisibleSprite,
  gridChoices,
  imagesUsed,
  layerMode,
  paintValue,
  pushSpriteUndo,
  removeActorAction,
  setActionFrames,
  setActionInterval,
  setCellColor,
  setMultiColor,
  setSpritePixel,
  slotIndices,
  specImageCount,
  spriteBytes,
  undoSprite,
} from "./sprites.js";

const $ = (id) => document.getElementById(id);

export function mountSprite(session, { setStatus }) {
  const canvas = $("sprite-canvas");
  const wizardEl = $("sprite-wizard");
  const workEl = $("sprite-work");
  const emptyEl = $("sprite-empty");
  const actorSelect = $("sprite-actor");
  const nameInput = $("sprite-name");
  const usage = $("sprite-usage");
  const zoomSelect = $("zoom-sprite");
  const undoButton = $("sprite-undo");
  const actionSelect = $("sprite-action");
  const framesInput = $("sprite-frames");
  const intervalInput = $("sprite-interval");
  const pad = $("sprite-directions");
  const frameLabel = $("sprite-frame-label");
  const playButton = $("sprite-play");
  const stopButton = $("sprite-stop");
  const placeButton = $("sprite-place");
  const clearButton = $("sprite-clear-place");
  const actionForm = $("sprite-action-form");
  const actionTypes = $("sprite-action-types");
  const spritePick = $("sprite-pick");
  const palette = $("sprite-palette");
  const paintRoles = $("sprite-paint");
  const colorHint = $("sprite-color-hint");

  let wizard = null;
  let stroke = null;
  let timer = 0;
  let padKey = "";
  let actionKey = "";
  let assign = { kind: "cell" };

  for (const value of SPRITE_ZOOMS) {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = `${value}×`;
    zoomSelect.append(option);
  }

  for (let index = 0; index < 16; index += 1) {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "swatch";
    swatch.dataset.index = String(index);
    swatch.style.background = C64_COLORS[index];
    swatch.title = `${index} ${C64_NAMES[index]}`;
    swatch.setAttribute("role", "radio");
    swatch.setAttribute("aria-label", C64_NAMES[index]);
    swatch.addEventListener("click", () => assignPalette(index));
    palette.append(swatch);
  }

  function current() {
    return actorById(session.project, session.ui.spriteActorId) || session.project.actors[0] || null;
  }

  function ensurePose(actor) {
    const pose = displayPose(actor, session.ui);
    session.ui.spritePose = pose;
    session.ui.spriteActorId = actor.id;
    return pose;
  }

  function edit(reason, fn) {
    const wasDirty = session.ui.dirty;
    let changed = false;
    session.mutate(reason, (project) => {
      changed = fn(project) !== false;
    });
    if (!changed) session.ui.dirty = wasDirty;
    return changed;
  }

  function stop() {
    window.clearTimeout(timer);
    timer = 0;
    if (!session.ui.spritePlaying) return;
    session.ui.spritePlaying = false;
  }

  function actorLabel(actor) {
    const kind = actor.kind === "player" ? "Player" : actor.kind === "enemy" ? "Enemy" : "Action";
    return `${kind} · ${actor.name}`;
  }

  function openWizard() {
    stop();
    actionForm.hidden = true;
    wizard = {
      step: "kind",
      kind: "player",
      layers: 1,
      stack: "over-multi",
      gridW: 1,
      gridH: 1,
      directions: "cardinal",
      actions: [{ type: "walking", name: "Walking", frames: 3 }],
      template: true,
    };
    renderWizard();
    session.emit("chrome");
  }

  function closeWizard() {
    wizard = null;
  }

  function renderWizard() {
    wizardEl.replaceChildren();
    const title = document.createElement("h3");
    const body = document.createElement("div");
    body.className = "choice-grid";
    wizardEl.append(title, body);
    if (wizard.step === "kind") {
      title.textContent = "What kind of sprite actor?";
      choiceButtons(body, [
        ["player", "Player", "Controlled by the player"],
        ["enemy", "Enemy", "Opposes the player"],
        ["action", "Action", "Shots, items, and other actors"],
      ], wizard.kind, (value) => { wizard.kind = value; renderWizard(); });
    } else if (wizard.step === "layers") {
      title.textContent = "How many sprite layers?";
      choiceButtons(body, [
        ["1", "Single-layered", "One sprite in each grid cell"],
        ["2", "Dual-layered", "Two sprites stacked to fake extra colors"],
      ], String(wizard.layers), (value) => {
        wizard.layers = Number(value);
        if (!gridChoices(wizard.layers === 2).some((choice) => choice.w === wizard.gridW && choice.h === wizard.gridH)) {
          wizard.gridW = 1;
          wizard.gridH = 1;
        }
        renderWizard();
      });
    } else if (wizard.step === "stack") {
      title.textContent = "How do the two layers combine?";
      choiceButtons(body, [
        ["over-multi", "Single color on multicolor", "A one-color sprite over a multicolor sprite"],
        ["over-single", "Single color on single color", "A one-color sprite over another one-color sprite"],
      ], wizard.stack, (value) => { wizard.stack = value; renderWizard(); });
    } else if (wizard.step === "grid") {
      title.textContent = "How many sprites wide and tall?";
      const choices = gridChoices(wizard.layers === 2).map((choice) => [
        `${choice.w}x${choice.h}`,
        `${choice.w}×${choice.h}`,
        choice.w * choice.h === 1 ? "One sprite" : `${choice.w * choice.h} sprites${wizard.layers === 2 ? ", two layers each" : ""}`,
      ]);
      choiceButtons(body, choices, `${wizard.gridW}x${wizard.gridH}`, (value) => {
        const [w, h] = value.split("x").map(Number);
        wizard.gridW = w;
        wizard.gridH = h;
        renderWizard();
      });
    } else if (wizard.step === "directions") {
      title.textContent = "Which directions can it move?";
      const choices = Object.values(DIRECTION_SETS).map((set) => [set.id, set.label, set.detail]);
      choiceButtons(body, choices, wizard.directions, (value) => { wizard.directions = value; renderWizard(); });
      const note = document.createElement("p");
      note.className = "hint";
      note.textContent = "Climbing and jumping are actions, not directions. A platform game should use horizontal movement only.";
      wizardEl.append(note);
    } else {
      title.textContent = "Which actions does it have?";
      body.className = "wizard-actions";
      renderActionStep(body);
    }
    const nav = document.createElement("div");
    nav.className = "wizard-nav";
    const back = document.createElement("button");
    back.type = "button";
    back.textContent = wizard.step === "kind" ? "Cancel" : "Back";
    back.addEventListener("click", () => {
      if (wizard.step === "kind") {
        closeWizard();
        session.emit("chrome");
        return;
      }
      wizard.step = previousStep(wizard);
      renderWizard();
    });
    nav.append(back);
    if (wizard.step === "actions") {
      const create = document.createElement("button");
      create.type = "button";
      create.textContent = "Create actor";
      const count = specImageCount(wizard);
      const free = SPRITE_COUNT - imagesUsed(session.project);
      create.disabled = wizard.actions.length === 0 || count > free;
      create.addEventListener("click", () => finishWizard());
      nav.append(create);
    } else {
      const next = document.createElement("button");
      next.type = "button";
      next.textContent = "Next";
      next.addEventListener("click", () => {
        wizard.step = nextStep(wizard);
        renderWizard();
      });
      nav.append(next);
    }
    wizardEl.append(nav);
  }

  function renderActionStep(body) {
    for (const action of wizard.actions) {
      const row = document.createElement("div");
      row.className = "action-row";
      const label = document.createElement("span");
      label.textContent = action.name;
      const frames = document.createElement("input");
      frames.type = "number";
      frames.min = "1";
      frames.max = "64";
      frames.value = String(action.frames);
      frames.setAttribute("aria-label", `${action.name} frames`);
      frames.addEventListener("change", () => {
        action.frames = clampWizardFrames(frames.value);
        frames.value = String(action.frames);
        renderWizard();
      });
      row.append(label, frames, document.createTextNode("frames"));
      if (wizard.actions.length > 1) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Remove";
        remove.addEventListener("click", () => {
          wizard.actions = wizard.actions.filter((entry) => entry !== action);
          renderWizard();
        });
        row.append(remove);
      }
      body.append(row);
    }
    const presets = document.createElement("div");
    presets.className = "choice-grid";
    for (const preset of ACTION_PRESETS) {
      if (wizard.actions.some((action) => action.type === preset.type)) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice";
      button.textContent = `${preset.name} · ${preset.frames} frame${preset.frames === 1 ? "" : "s"}`;
      button.addEventListener("click", () => {
        wizard.actions.push({ type: preset.type, name: preset.name, frames: preset.frames });
        renderWizard();
      });
      presets.append(button);
    }
    body.append(presets);
    const customRow = document.createElement("div");
    customRow.className = "action-row";
    const custom = document.createElement("input");
    custom.type = "text";
    custom.maxLength = 32;
    custom.placeholder = "Custom action";
    custom.setAttribute("aria-label", "Custom action name");
    const customFrames = document.createElement("input");
    customFrames.type = "number";
    customFrames.min = "1";
    customFrames.max = "64";
    customFrames.value = "1";
    customFrames.setAttribute("aria-label", "Custom action frames");
    const add = document.createElement("button");
    add.type = "button";
    add.textContent = "Add custom";
    add.addEventListener("click", () => {
      const name = custom.value.trim();
      if (!name) {
        setStatus("Type a name for the custom action.", true);
        return;
      }
      wizard.actions.push({ type: "custom", name, frames: clampWizardFrames(customFrames.value) });
      renderWizard();
    });
    customRow.append(custom, customFrames, document.createTextNode("frames"), add);
    body.append(customRow);
    const template = document.createElement("label");
    template.className = "check";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = wizard.template;
    box.addEventListener("change", () => { wizard.template = box.checked; });
    template.append(box, document.createTextNode("Use stick-figure templates for the standard actions"));
    body.append(template);
    const count = specImageCount(wizard);
    const free = SPRITE_COUNT - imagesUsed(session.project);
    const cost = document.createElement("p");
    cost.className = count > free ? "cost warn" : "cost";
    cost.textContent = count > free
      ? `Needs ${count} sprite images, and ${free} of ${SPRITE_COUNT} are free.`
      : `Uses ${count} of ${SPRITE_COUNT} sprite images. ${free} are free.`;
    body.append(cost);
  }

  function finishWizard() {
    const spec = {
      kind: wizard.kind,
      layers: wizard.layers,
      stack: wizard.layers === 2 ? wizard.stack : "single",
      gridW: wizard.gridW,
      gridH: wizard.gridH,
      directions: wizard.directions,
      actions: wizard.actions.map((action) => ({ ...action })),
      template: wizard.template,
    };
    let created = null;
    const changed = edit("sprites", (project) => {
      const result = createActor(project, spec);
      if (!result.ok) {
        setStatus(result.error, true);
        return false;
      }
      created = result.actor;
      closeWizard();
      focusActor(created);
      return true;
    });
    if (changed) setStatus(`Created ${created.name}.`);
  }

  function focusActor(actor) {
    const layer = actor.layers === 2 ? 1 : 0;
    session.ui.spriteActorId = actor.id;
    session.ui.spriteLayer = layer;
    session.ui.spriteCell = { x: 0, y: 0 };
    session.ui.spritePose = displayPose(actor, null);
    session.ui.spritePaint = { kind: "ink", color: cellColor(actor, 0, 0, layer) };
    session.ui.spritePlaceArmed = false;
    session.ui.spritePlaying = false;
    assign = { kind: "cell" };
  }

  function sync() {
    const actor = current();
    if (actor && session.ui.spriteActorId !== actor.id) focusActor(actor);
    wizardEl.hidden = !wizard;
    emptyEl.hidden = Boolean(wizard) || Boolean(actor);
    workEl.hidden = Boolean(wizard) || !actor;
    const labels = session.project.actors.map((entry) => `${entry.id}:${actorLabel(entry)}`).join("|");
    if (actorSelect.dataset.labels !== labels) {
      actorSelect.dataset.labels = labels;
      actorSelect.replaceChildren();
      for (const entry of session.project.actors) {
        const option = document.createElement("option");
        option.value = entry.id;
        option.textContent = actorLabel(entry);
        actorSelect.append(option);
      }
    }
    actorSelect.disabled = !actor;
    if (actor) actorSelect.value = actor.id;
    nameInput.disabled = !actor;
    if (actor && document.activeElement !== nameInput) nameInput.value = actor.name;
    $("sprite-delete").disabled = !actor;
    usage.textContent = `${imagesUsed(session.project)} / ${SPRITE_COUNT}`;
    zoomSelect.value = String(session.project.zoom.sprites);
    undoButton.disabled = session.project.spriteUndo.length === 0;
    if (!actor || wizard) return;
    const pose = ensurePose(actor);
    const action = actor.actions.find((entry) => entry.id === pose.actionId) || actor.actions[0];
    const signature = actor.actions.map((entry) => `${entry.id}:${entry.name}`).join("|");
    if (signature !== actionKey) {
      actionKey = signature;
      actionSelect.replaceChildren();
      for (const entry of actor.actions) {
        const option = document.createElement("option");
        option.value = entry.id;
        option.textContent = entry.name;
        actionSelect.append(option);
      }
    }
    actionSelect.value = action.id;
    if (document.activeElement !== framesInput) framesInput.value = String(action.frames);
    if (document.activeElement !== intervalInput) intervalInput.value = String(action.interval);
    syncPad(actor, pose);
    frameLabel.textContent = `Frame ${pose.frame + 1} / ${action.frames}`;
    playButton.disabled = false;
    stopButton.disabled = !session.ui.spritePlaying;
    placeButton.setAttribute("aria-pressed", String(session.ui.spritePlaceArmed));
    clearButton.disabled = !actor.placement;
    $("sprite-remove-action").disabled = actor.actions.length < 2;
    renderColors(actor);
    if (!actionForm.hidden) renderAddAction(actor);
  }

  function syncPad(actor, pose) {
    const key = `${actor.id}:${actor.directions}`;
    if (key !== padKey) {
      padKey = key;
      const set = directionSet(actor.directions);
      pad.style.gridTemplateColumns = `repeat(${set.cols}, max-content)`;
      pad.replaceChildren();
      for (let row = 0; row < set.rows; row += 1) {
        for (let col = 0; col < set.cols; col += 1) {
          const cell = set.cells.find((entry) => entry.col === col && entry.row === row);
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = cell.label;
          button.dataset.direction = cell.id;
          button.addEventListener("click", () => {
            stop();
            session.ui.spritePlaying = false;
            const live = ensurePose(actor);
            session.ui.spritePose = { ...live, directionId: cell.id, frame: 0 };
            session.emit("sprites-live");
            sync();
          });
          pad.append(button);
        }
      }
    }
    for (const button of pad.querySelectorAll("button")) {
      button.setAttribute("aria-pressed", String(button.dataset.direction === pose.directionId));
    }
  }

  function selectedSprite(actor) {
    const layer = actor.layers === 1 ? 0 : Math.min(Math.max(session.ui.spriteLayer, 0), actor.layers - 1);
    const x = Math.min(Math.max(session.ui.spriteCell.x, 0), actor.grid.width - 1);
    const y = Math.min(Math.max(session.ui.spriteCell.y, 0), actor.grid.height - 1);
    session.ui.spriteLayer = layer;
    session.ui.spriteCell = { x, y };
    return { x, y, layer };
  }

  function spriteChoiceLabel(actor, x, y, layer) {
    const grid = `Grid ${x + 1},${y + 1}`;
    if (actor.layers === 1) return grid;
    return `${grid} · ${layer === 0 ? "Bottom" : "Top"}`;
  }

  function renderColors(actor) {
    const { x, y, layer } = selectedSprite(actor);
    const mode = layerMode(actor, layer);
    if ((assign.kind === "multi0" || assign.kind === "multi1") && mode !== "multi") assign = { kind: "cell" };
    spritePick.replaceChildren();
    for (let gy = 0; gy < actor.grid.height; gy += 1) {
      for (let gx = 0; gx < actor.grid.width; gx += 1) {
        for (let entry = 0; entry < actor.layers; entry += 1) {
          const color = cellColor(actor, gx, gy, entry);
          const label = spriteChoiceLabel(actor, gx, gy, entry);
          const choice = document.createElement("label");
          choice.className = "sprite-radio";
          const input = document.createElement("input");
          input.type = "radio";
          input.name = "sprite-target";
          input.value = `${gx},${gy},${entry}`;
          input.checked = gx === x && gy === y && entry === layer;
          input.setAttribute("aria-label", `${label}, ${C64_NAMES[color]}`);
          input.addEventListener("change", () => {
            if (!input.checked) return;
            session.ui.spriteCell = { x: gx, y: gy };
            session.ui.spriteLayer = entry;
            session.ui.spritePaint = { kind: "ink", color: cellColor(actor, gx, gy, entry) };
            assign = { kind: "cell" };
            session.emit("chrome");
          });
          const chip = document.createElement("i");
          chip.style.background = C64_COLORS[color];
          chip.setAttribute("aria-hidden", "true");
          choice.append(input, chip, document.createTextNode(label));
          spritePick.append(choice);
        }
      }
    }
    const selectedColor = assign.kind === "cell"
      ? cellColor(actor, x, y, layer)
      : actor[assign.kind];
    for (const swatch of palette.children) {
      swatch.setAttribute("aria-checked", String(Number(swatch.dataset.index) === selectedColor));
    }
    paintRoles.replaceChildren();
    const spriteColor = cellColor(actor, x, y, layer);
    const paints = [
      { kind: "clear", label: "Transparent", color: null },
      { kind: "ink", label: C64_NAMES[spriteColor], color: spriteColor },
    ];
    if (mode === "multi") {
      paints.push(
        { kind: "multi0", label: `Multicolor 0 · ${C64_NAMES[actor.multi0]}`, color: actor.multi0 },
        { kind: "multi1", label: `Multicolor 1 · ${C64_NAMES[actor.multi1]}`, color: actor.multi1 },
      );
    }
    for (const paint of paints) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "role";
      const pressed = session.ui.spritePaint.kind === paint.kind
        && (paint.kind !== "ink" || session.ui.spritePaint.color === paint.color);
      button.setAttribute("aria-pressed", String(pressed));
      if (paint.color != null) {
        const chip = document.createElement("i");
        chip.style.background = C64_COLORS[paint.color];
        button.append(chip);
      }
      button.append(document.createTextNode(paint.label));
      button.addEventListener("click", () => {
        if (paint.kind === "ink") {
          session.ui.spritePaint = { kind: "ink", color: paint.color };
          assign = { kind: "cell" };
        } else if (paint.kind === "multi0" || paint.kind === "multi1") {
          session.ui.spritePaint = { kind: paint.kind };
          assign = { kind: paint.kind };
        } else {
          session.ui.spritePaint = { kind: "clear" };
        }
        session.emit("chrome");
      });
      paintRoles.append(button);
    }
    const where = spriteChoiceLabel(actor, x, y, layer);
    colorHint.textContent = mode === "multi"
      ? `${where}. The palette sets the selected color for this sprite. Multicolor 0 and 1 are shared by every multicolor sprite. Painting stays on this sprite. Right-click erases.`
      : `${where}. The palette sets this sprite’s color. Painting stays on this sprite. Right-click erases.`;
  }

  function assignPalette(index) {
    const actor = current();
    if (!actor || wizard) return;
    const layer = session.ui.spriteLayer;
    const cell = session.ui.spriteCell;
    if (assign.kind === "cell") session.ui.spritePaint = { kind: "ink", color: index };
    const changed = edit("sprites", () => {
      if (assign.kind === "multi0" || assign.kind === "multi1") return setMultiColor(actor, assign.kind, index);
      return setCellColor(actor, cell.x, cell.y, layer, index);
    });
    if (!changed) session.emit("chrome");
  }

  function renderAddAction(actor) {
    actionTypes.replaceChildren();
    for (const preset of ACTION_PRESETS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice";
      button.disabled = actor.actions.some((action) => action.type === preset.type);
      button.textContent = preset.name;
      const detail = document.createElement("small");
      detail.textContent = `${preset.frames} frame${preset.frames === 1 ? "" : "s"} by default`;
      button.append(detail);
      button.addEventListener("click", () => {
        $("sprite-action-frames").value = String(preset.frames);
        commitAction(actor, { type: preset.type, frames: preset.frames, template: $("sprite-action-template").checked });
      });
      actionTypes.append(button);
    }
  }

  function commitAction(actor, spec) {
    let added = null;
    const changed = edit("sprites", (project) => {
      const live = actorById(project, actor.id);
      const result = addActorAction(project, live, spec);
      if (!result.ok) {
        setStatus(result.error, true);
        return false;
      }
      added = result.action;
      actionForm.hidden = true;
      session.ui.spritePose = {
        actorId: actor.id,
        actionId: added.id,
        directionId: directionSet(actor.directions).cells[0].id,
        frame: 0,
      };
      return true;
    });
    if (changed) setStatus(`Added ${added.name}.`);
  }

  function draw() {
    const actor = current();
    if (!actor || wizard) return;
    const pose = ensurePose(actor);
    const action = actor.actions.find((entry) => entry.id === pose.actionId) || actor.actions[0];
    frameLabel.textContent = `Frame ${pose.frame + 1} / ${action.frames}`;
    stopButton.disabled = !session.ui.spritePlaying;
    const zoom = session.project.zoom.sprites || 8;
    const width = actor.grid.width * 24 * zoom;
    const height = actor.grid.height * 21 * zoom;
    const ctx = prepareCanvas(canvas, width, height);
    ctx.fillStyle = C64_COLORS[session.project.colors.background & 15];
    ctx.fillRect(0, 0, width, height);
    eachVisibleSprite(session.project, actor, pose, (sprite) => {
      drawHardwareSprite(
        ctx,
        sprite.bytes,
        sprite.gx * 24 * zoom,
        sprite.gy * 21 * zoom,
        zoom,
        sprite.mode,
        sprite,
      );
    });
    drawGrid(ctx, actor, zoom);
  }

  function drawGrid(ctx, actor, zoom) {
    const multi = layerMode(actor, session.ui.spriteLayer) === "multi";
    const stepX = multi ? zoom * 2 : zoom;
    ctx.save();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gy = 0; gy < actor.grid.height; gy += 1) {
      for (let gx = 0; gx < actor.grid.width; gx += 1) {
        const left = gx * 24 * zoom;
        const top = gy * 21 * zoom;
        for (let x = stepX; x < 24 * zoom; x += stepX) {
          ctx.moveTo(left + x + 0.5, top);
          ctx.lineTo(left + x + 0.5, top + 21 * zoom);
        }
        for (let y = zoom; y < 21 * zoom; y += zoom) {
          ctx.moveTo(left, top + y + 0.5);
          ctx.lineTo(left + 24 * zoom, top + y + 0.5);
        }
      }
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(142, 176, 255, 0.85)";
    ctx.lineWidth = 2;
    const cell = session.ui.spriteCell;
    ctx.strokeRect(cell.x * 24 * zoom + 1, cell.y * 21 * zoom + 1, 24 * zoom - 2, 21 * zoom - 2);
    if (actor.grid.width > 1 || actor.grid.height > 1) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let gx = 1; gx < actor.grid.width; gx += 1) {
        ctx.moveTo(gx * 24 * zoom + 0.5, 0);
        ctx.lineTo(gx * 24 * zoom + 0.5, actor.grid.height * 21 * zoom);
      }
      for (let gy = 1; gy < actor.grid.height; gy += 1) {
        ctx.moveTo(0, gy * 21 * zoom + 0.5);
        ctx.lineTo(actor.grid.width * 24 * zoom, gy * 21 * zoom + 0.5);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function pointAt(event) {
    const rect = canvas.getBoundingClientRect();
    const zoom = session.project.zoom.sprites || 8;
    if (rect.width <= 0 || rect.height <= 0) return null;
    const px = Math.floor((event.clientX - rect.left) / zoom);
    const py = Math.floor((event.clientY - rect.top) / zoom);
    return {
      gx: Math.floor(px / 24),
      gy: Math.floor(py / 21),
      lx: px % 24,
      ly: py % 21,
    };
  }

  function paintAt(point) {
    const actor = current();
    if (!actor || !point) return false;
    const layer = session.ui.spriteLayer;
    const cell = session.ui.spriteCell;
    if (point.gx !== cell.x || point.gy !== cell.y) return false;
    if (!acceptsPaint(actor, point.gx, point.gy, layer, stroke.paint)) return false;
    const value = paintValue(actor, layer, stroke.paint);
    if (value == null) return false;
    const pose = ensurePose(actor);
    const indices = slotIndices(actor, pose.actionId, pose.directionId, pose.frame);
    if (!indices) return false;
    const index = indices[(layer * actor.grid.height + point.gy) * actor.grid.width + point.gx];
    if (!stroke.before.has(index)) stroke.before.set(index, spriteBytes(session.project, index).slice());
    const bytes = spriteBytes(session.project, index);
    const mode = layerMode(actor, layer);
    if (mode === "hires") return setSpritePixel(bytes, "hires", point.lx, point.ly, value);
    return setSpritePixel(bytes, "multi", point.lx >> 1, point.ly, value);
  }

  function beginStroke(event) {
    const actor = current();
    if (!actor || wizard) return;
    stop();
    session.ui.spritePlaying = false;
    session.ui.lastSurface = "sprite";
    stroke = {
      paint: event.button === 2 ? { kind: "clear" } : session.ui.spritePaint,
      before: new Map(),
    };
    if (paintAt(pointAt(event))) session.emit("sprites-live");
  }

  function endStroke(commit) {
    if (!stroke) return;
    const project = session.project;
    const cells = [];
    for (const [index, bytes] of stroke.before) {
      const now = spriteBytes(project, index);
      if (!commit) now.set(bytes);
      else if (!sameBytes(bytes, now)) cells.push({ index, bytes });
    }
    stroke = null;
    if (commit && cells.length) {
      pushSpriteUndo(project, cells);
      session.ui.dirty = true;
    }
    session.emit(commit ? "sprites" : "sprites-live");
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
    if (paintAt(pointAt(event))) session.emit("sprites-live");
  });
  canvas.addEventListener("pointerup", () => endStroke(true));
  canvas.addEventListener("pointercancel", () => endStroke(false));

  $("sprite-new").addEventListener("click", () => openWizard());
  actorSelect.addEventListener("change", () => {
    stop();
    session.ui.spritePlaying = false;
    const actor = actorById(session.project, actorSelect.value);
    if (!actor) return;
    actionForm.hidden = true;
    focusActor(actor);
    session.emit("sprites");
  });
  nameInput.addEventListener("input", () => {
    const actor = current();
    if (!actor) return;
    actor.name = nameInput.value;
    session.ui.dirty = true;
    const option = [...actorSelect.options].find((entry) => entry.value === actor.id);
    if (option) option.textContent = actorLabel(actor);
  });
  nameInput.addEventListener("change", () => {
    const actor = current();
    if (!actor) return;
    actor.name = nameInput.value.trim() || actor.name;
    nameInput.value = actor.name;
    session.emit("chrome");
  });
  $("sprite-delete").addEventListener("click", () => {
    const actor = current();
    if (!actor) return;
    if (!window.confirm(`Delete ${actor.name}?`)) return;
    stop();
    session.ui.spritePlaying = false;
    edit("sprites", (project) => deleteActor(project, actor.id));
    session.ui.spriteActorId = session.project.actors[0]?.id ?? null;
    session.ui.spritePose = null;
    actionForm.hidden = true;
    setStatus(`Deleted ${actor.name}.`);
  });
  zoomSelect.addEventListener("change", () => session.setZoom("sprites", Number(zoomSelect.value)));
  undoButton.addEventListener("click", () => edit("sprites", undoSprite));
  actionSelect.addEventListener("change", () => {
    stop();
    session.ui.spritePlaying = false;
    const actor = current();
    const pose = ensurePose(actor);
    session.ui.spritePose = { ...pose, actionId: actionSelect.value, frame: 0 };
    session.emit("sprites");
  });
  framesInput.addEventListener("change", () => {
    const actor = current();
    if (!actor) return;
    const pose = ensurePose(actor);
    const frames = Number(framesInput.value);
    const before = actor.actions.find((entry) => entry.id === pose.actionId)?.frames ?? frames;
    let message = "";
    const changed = edit("sprites", (project) => {
      const live = actorById(project, actor.id);
      const result = setActionFrames(project, live, pose.actionId, frames);
      if (!result.ok) {
        message = result.error;
        return false;
      }
      return result.changed;
    });
    if (message) {
      setStatus(message, true);
      framesInput.value = String(before);
    } else if (changed && frames > before) setStatus("Added blank frames.");
    const action = actor.actions.find((entry) => entry.id === pose.actionId);
    if (action && session.ui.spritePose && session.ui.spritePose.frame >= action.frames) {
      session.ui.spritePose = { ...session.ui.spritePose, frame: action.frames - 1 };
      session.emit("sprites-live");
    }
    if (!changed) session.emit("chrome");
  });
  intervalInput.addEventListener("change", () => {
    const actor = current();
    if (!actor) return;
    const pose = ensurePose(actor);
    const interval = Number(intervalInput.value);
    const changed = edit("sprites", (project) => setActionInterval(actorById(project, actor.id), pose.actionId, interval));
    if (!changed) {
      const action = actor.actions.find((entry) => entry.id === pose.actionId);
      intervalInput.value = String(action.interval);
      setStatus("Frame time must be from 40 to 2000 milliseconds.", true);
    }
  });
  $("sprite-frame-prev").addEventListener("click", () => stepFrame(-1));
  $("sprite-frame-next").addEventListener("click", () => stepFrame(1));
  function stepFrame(delta) {
    const actor = current();
    if (!actor) return;
    stop();
    session.ui.spritePlaying = false;
    const pose = ensurePose(actor);
    const action = actor.actions.find((entry) => entry.id === pose.actionId);
    const frame = (pose.frame + delta + action.frames) % action.frames;
    session.ui.spritePose = { ...pose, frame };
    session.emit("sprites-live");
    sync();
  }
  $("sprite-play").addEventListener("click", () => play());
  $("sprite-stop").addEventListener("click", () => {
    stop();
    session.emit("chrome");
  });
  $("sprite-place").addEventListener("click", () => {
    const actor = current();
    if (!actor) return;
    session.ui.spritePlaceArmed = !session.ui.spritePlaceArmed;
    setStatus(session.ui.spritePlaceArmed ? "Click the screen to place this actor." : "Placement cancelled.");
    session.emit("sprites");
  });
  $("sprite-clear-place").addEventListener("click", () => {
    const actor = current();
    if (!actor) return;
    edit("sprites", (project) => clearPlacement(actorById(project, actor.id)));
    setStatus("Cleared the actor from the screen.");
  });
  $("sprite-add-action").addEventListener("click", () => {
    const actor = current();
    if (!actor) return;
    actionForm.hidden = !actionForm.hidden;
    if (!actionForm.hidden) renderAddAction(actor);
  });
  $("sprite-action-cancel").addEventListener("click", () => { actionForm.hidden = true; });
  $("sprite-custom-add").addEventListener("click", () => {
    const actor = current();
    if (!actor) return;
    commitAction(actor, {
      type: "custom",
      name: $("sprite-custom-action").value,
      frames: Number($("sprite-action-frames").value),
      template: false,
    });
    $("sprite-custom-action").value = "";
  });
  $("sprite-remove-action").addEventListener("click", () => {
    const actor = current();
    if (!actor) return;
    const pose = ensurePose(actor);
    const action = actor.actions.find((entry) => entry.id === pose.actionId);
    if (!action) return;
    let removed = false;
    edit("sprites", (project) => {
      const result = removeActorAction(project, actorById(project, actor.id), action.id);
      if (!result.ok) {
        setStatus(result.error, true);
        return false;
      }
      removed = true;
      session.ui.spritePose = null;
      return true;
    });
    if (removed) setStatus(`Removed ${action.name}.`);
  });

  function play() {
    const actor = current();
    if (!actor) return;
    const pose = ensurePose(actor);
    const action = actor.actions.find((entry) => entry.id === pose.actionId);
    if (!actor.placement) {
      edit("sprites", (project) => {
        const live = actorById(project, actor.id);
        live.placement = {
          x: 16,
          y: 40,
          actionId: pose.actionId,
          directionId: pose.directionId,
          frame: pose.frame,
        };
      });
      setStatus("Placed the actor on the screen so the animation can play there.");
    }
    stop();
    session.ui.spritePlaying = true;
    const tick = () => {
      const live = current();
      if (!live || !session.ui.spritePlaying) return;
      const livePose = ensurePose(live);
      const liveAction = live.actions.find((entry) => entry.id === livePose.actionId);
      if (!liveAction) {
        stop();
        session.emit("chrome");
        return;
      }
      const frame = (livePose.frame + 1) % liveAction.frames;
      session.ui.spritePose = { ...livePose, frame };
      if (live.placement) {
        live.placement.actionId = livePose.actionId;
        live.placement.directionId = livePose.directionId;
        live.placement.frame = frame;
      }
      session.emit("sprites-live");
      timer = window.setTimeout(tick, liveAction.interval);
    };
    timer = window.setTimeout(tick, action.interval);
    session.emit("chrome");
  }

  session.subscribe((reason) => {
    if (reason === "project") {
      stop();
      wizard = null;
      actionForm.hidden = true;
      padKey = "";
      actionKey = "";
    }
  });

  return { draw, stop, sync };
}

function choiceButtons(parent, choices, selected, onPick) {
  for (const [value, label, detail] of choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";
    button.setAttribute("aria-pressed", String(value === selected));
    button.append(document.createTextNode(label));
    if (detail) {
      const small = document.createElement("small");
      small.textContent = detail;
      button.append(small);
    }
    button.addEventListener("click", () => onPick(value));
    parent.append(button);
  }
}

function nextStep(wizard) {
  if (wizard.step === "kind") return "layers";
  if (wizard.step === "layers") return wizard.layers === 2 ? "stack" : "grid";
  if (wizard.step === "stack") return "grid";
  if (wizard.step === "grid") return "directions";
  return "actions";
}

function previousStep(wizard) {
  if (wizard.step === "actions") return "directions";
  if (wizard.step === "directions") return "grid";
  if (wizard.step === "grid") return wizard.layers === 2 ? "stack" : "layers";
  if (wizard.step === "stack") return "layers";
  return "kind";
}

function clampWizardFrames(value) {
  const frames = Number(value);
  if (!Number.isInteger(frames)) return 1;
  return Math.min(64, Math.max(1, frames));
}
