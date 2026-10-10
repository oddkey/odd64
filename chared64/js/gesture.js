const SLOP = 10;

export function isPhoneLayout() {
  return window.matchMedia("(max-width: 980px)").matches;
}

export function touchUsesTap(event, { draws = false } = {}) {
  if (event.pointerType !== "touch" || !isPhoneLayout()) return false;
  if (draws && document.body.classList.contains("draw-mode")) return false;
  return true;
}

export function bindTap(element, { enabled, onTap }) {
  let tap = null;

  element.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !enabled(event)) return;
    tap = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  });

  element.addEventListener("pointermove", (event) => {
    if (!tap || event.pointerId !== tap.id) return;
    const dx = event.clientX - tap.x;
    const dy = event.clientY - tap.y;
    if (dx * dx + dy * dy > SLOP * SLOP) tap.moved = true;
  });

  element.addEventListener("pointerup", (event) => {
    if (!tap || event.pointerId !== tap.id) return;
    const done = tap;
    tap = null;
    if (!done.moved) onTap({ clientX: done.x, clientY: done.y, button: 0, shiftKey: event.shiftKey });
  });

  element.addEventListener("pointercancel", (event) => {
    if (tap && event.pointerId === tap.id) tap = null;
  });
}
