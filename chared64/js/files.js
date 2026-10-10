import {
  CHARSET_BYTES,
  EDITOR_ZOOMS,
  MAP_ZOOMS,
  TILE_MAX,
  createBlankProject,
} from "./project.js";

function fail(error) {
  return { ok: false, error };
}

function isByte(value) {
  return Number.isInteger(value) && value >= 0 && value <= 255;
}

function readBytes(value, length, label) {
  if (!Array.isArray(value) || value.length !== length) {
    return `${label} must be an array of ${length} numbers.`;
  }
  for (let i = 0; i < value.length; i += 1) {
    if (!isByte(value[i])) return `${label} entry ${i} must be an integer from 0 to 255.`;
  }
  return "";
}

function readColor(value, max, label) {
  if (!Number.isInteger(value) || value < 0 || value > max) {
    return `${label} must be an integer from 0 to ${max}.`;
  }
  return "";
}

export function serializeProject(project) {
  return {
    name: project.name,
    mode: project.mode,
    activeSet: project.activeSet,
    colors: { ...project.colors },
    zoom: { ...project.zoom },
    tileSize: { width: project.tileWidth, height: project.tileHeight },
    characters: Array.from(project.characters),
    tiles: {
      chars: Array.from(project.tileChars),
      colors: Array.from(project.tileColors),
    },
  };
}

export function parseProject(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return fail("Project file must be a JSON object.");
  }
  if (typeof data.name !== "string") return fail("Project name must be text.");
  if (data.mode !== "single" && data.mode !== "multi") {
    return fail("Mode must be single or multi.");
  }
  if (data.activeSet !== "upper" && data.activeSet !== "lower") {
    return fail("Active set must be upper or lower.");
  }
  const colors = data.colors || {};
  const colorError =
    readColor(colors.background, 15, "Background") ||
    readColor(colors.foreground, 15, "Foreground") ||
    readColor(colors.multi1, 15, "Multicolor 1") ||
    readColor(colors.multi2, 15, "Multicolor 2") ||
    readColor(colors.multiCell, 7, "Cell color");
  if (colorError) return fail(colorError);

  const zoom = data.zoom || {};
  if (!MAP_ZOOMS.includes(zoom.characters) || !MAP_ZOOMS.includes(zoom.tiles)) {
    return fail("Character and tile zoom must be 1, 2, 4, 8, or 16.");
  }
  if (!EDITOR_ZOOMS.includes(zoom.editor)) {
    return fail("Editor zoom must be 16, 32, 64, 128, or 256.");
  }

  const size = data.tileSize || {};
  if (
    !Number.isInteger(size.width) ||
    !Number.isInteger(size.height) ||
    size.width < 1 ||
    size.height < 1 ||
    size.width > TILE_MAX ||
    size.height > TILE_MAX
  ) {
    return fail("Tile width and height must be whole numbers from 1 to 256.");
  }

  const characterError = readBytes(data.characters, CHARSET_BYTES, "Character data");
  if (characterError) return fail(characterError);
  const count = size.width * size.height;
  const tiles = data.tiles || {};
  const charError = readBytes(tiles.chars, count, "Tile characters");
  if (charError) return fail(charError);
  const colorBytesError = readBytes(tiles.colors, count, "Tile colors");
  if (colorBytesError) return fail(colorBytesError);

  const project = createBlankProject();
  project.name = data.name;
  project.mode = data.mode;
  project.activeSet = data.activeSet;
  project.colors = {
    background: colors.background,
    foreground: colors.foreground,
    multi1: colors.multi1,
    multi2: colors.multi2,
    multiCell: colors.multiCell,
  };
  project.zoom = {
    characters: zoom.characters,
    editor: zoom.editor,
    tiles: zoom.tiles,
  };
  project.tileWidth = size.width;
  project.tileHeight = size.height;
  project.characters = Uint8Array.from(data.characters);
  project.tileChars = Uint8Array.from(tiles.chars);
  project.tileColors = Uint8Array.from(tiles.colors);
  return { ok: true, project };
}

export function parseProjectText(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return fail("Project file is not valid JSON.");
  }
  return parseProject(data);
}
