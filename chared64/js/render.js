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
