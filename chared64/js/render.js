import { colorRgb } from "./colors.js";

const cache = new Map();

function spriteKey(bytes, mode, colors, ink) {
  let bits = "";
  for (let i = 0; i < 8; i += 1) bits += bytes[i].toString(16).padStart(2, "0");
  if (mode === "single") return `s|${colors.background}|${ink}|${bits}`;
  return `m|${colors.background}|${colors.multi1}|${colors.multi2}|${ink}|${bits}`;
}

function plot(data, x, y, rgb) {
  const i = (y * 8 + x) * 4;
  data[i] = rgb[0];
  data[i + 1] = rgb[1];
  data[i + 2] = rgb[2];
  data[i + 3] = 255;
}

function makeSprite(bytes, mode, colors, ink) {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 8;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(8, 8);
  const bg = colorRgb(colors.background);
  if (mode === "single") {
    const fg = colorRgb(ink);
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        plot(image.data, x, y, bytes[y] & (0x80 >> x) ? fg : bg);
      }
    }
  } else {
    const slots = [bg, colorRgb(colors.multi1), colorRgb(colors.multi2), colorRgb(ink)];
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 4; x += 1) {
        const pair = (bytes[y] >> (6 - x * 2)) & 3;
        const rgb = slots[pair];
        plot(image.data, x * 2, y, rgb);
        plot(image.data, x * 2 + 1, y, rgb);
      }
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

const hardwareCache = new Map();

function hardwareKey(bytes, mode, ink, multi0, multi1) {
  let bits = "";
  for (let i = 0; i < 63; i += 1) bits += bytes[i].toString(16).padStart(2, "0");
  return `${mode}|${ink}|${multi0}|${multi1}|${bits}`;
}

function paintHardware(data, x, y, rgb) {
  const i = (y * 24 + x) * 4;
  data[i] = rgb[0];
  data[i + 1] = rgb[1];
  data[i + 2] = rgb[2];
  data[i + 3] = 255;
}

function makeHardwareSprite(bytes, mode, ink, multi0, multi1) {
  const canvas = document.createElement("canvas");
  canvas.width = 24;
  canvas.height = 21;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(24, 21);
  const fg = colorRgb(ink);
  if (mode === "hires") {
    for (let y = 0; y < 21; y += 1) {
      for (let x = 0; x < 24; x += 1) {
        if (bytes[y * 3 + (x >> 3)] & (0x80 >> (x & 7))) paintHardware(image.data, x, y, fg);
      }
    }
  } else {
    const slots = [null, colorRgb(multi0), fg, colorRgb(multi1)];
    for (let y = 0; y < 21; y += 1) {
      for (let x = 0; x < 12; x += 1) {
        const pair = (bytes[y * 3 + (x >> 2)] >> (6 - (x & 3) * 2)) & 3;
        const rgb = slots[pair];
        if (!rgb) continue;
        paintHardware(image.data, x * 2, y, rgb);
        paintHardware(image.data, x * 2 + 1, y, rgb);
      }
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export function drawHardwareSprite(ctx, bytes, x, y, zoom, mode, source) {
  const ink = source.color & 15;
  const multi0 = source.multi0 & 15;
  const multi1 = source.multi1 & 15;
  const key = hardwareKey(bytes, mode, ink, multi0, multi1);
  let sprite = hardwareCache.get(key);
  if (!sprite) {
    sprite = makeHardwareSprite(bytes, mode, ink, multi0, multi1);
    hardwareCache.set(key, sprite);
    if (hardwareCache.size > 4000) hardwareCache.clear();
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, x, y, 24 * zoom, 21 * zoom);
}

export function drawGlyph(ctx, bytes, x, y, zoom, mode, colors, ink) {
  const key = spriteKey(bytes, mode, colors, ink);
  let sprite = cache.get(key);
  if (!sprite) {
    sprite = makeSprite(bytes, mode, colors, ink);
    cache.set(key, sprite);
    if (cache.size > 5000) cache.clear();
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, x, y, 8 * zoom, 8 * zoom);
}

export function contentBoxWidth(element) {
  if (!element) return 0;
  const style = getComputedStyle(element);
  const pad = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  return Math.max(0, element.clientWidth - pad);
}

export function prepareCanvas(canvas, cssWidth, cssHeight) {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, cssWidth);
  const height = Math.max(1, cssHeight);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const bufferW = Math.max(1, Math.round(width * dpr));
  const bufferH = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== bufferW || canvas.height !== bufferH) {
    canvas.width = bufferW;
    canvas.height = bufferH;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

export function displayInk(project, stored) {
  return project.mode === "multi" ? stored & 7 : stored & 15;
}
