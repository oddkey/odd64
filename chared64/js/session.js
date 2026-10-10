export function createSession(project) {
  let current = project;
  const listeners = new Set();
  const ui = {
    dirty: false,
    paintRole: "foreground",
    tileTool: "char",
    tileShape: "pen",
    tileCursor: null,
    tileSelection: null,
    screenClipboard: null,
    tileInk: 14,
    lastSurface: "editor",
    fitCharacters: false,
    fitEditor: false,
    touchDraw: false,
    clipboard: null,
  };

  function emit(reason) {
    for (const listener of listeners) listener(reason);
  }

  function coerceRole() {
    const allowed =
      current.mode === "single"
        ? ["background", "foreground"]
        : ["background", "multi1", "multi2", "cell"];
    if (!allowed.includes(ui.paintRole)) {
      ui.paintRole = current.mode === "single" ? "foreground" : "cell";
    }
  }

  return {
    ui,
    get project() {
      return current;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit,
    replaceProject(next) {
      current = next;
      ui.dirty = false;
      ui.tileSelection = null;
      ui.tileCursor = ui.tileShape === "type" ? { x: 0, y: 0, homeX: 0 } : null;
      ui.paintRole = next.mode === "multi" ? "cell" : "foreground";
      ui.tileInk = next.mode === "multi" ? next.colors.multiCell : next.colors.foreground;
      emit("project");
    },
    mutate(reason, fn) {
      fn(current);
      ui.dirty = true;
      emit(reason);
    },
    select(index, options = {}) {
      if (!options.extend) current.selectAnchor = index;
      else if (current.selectAnchor == null) current.selectAnchor = current.selected;
      current.selected = index;
      ui.lastSurface = "map";
      emit("selection");
    },
    setZoom(part, value) {
      current.zoom[part] = value;
      ui.dirty = true;
      emit("view");
    },
    setMode(mode) {
      if (current.mode === mode) return;
      current.mode = mode;
      coerceRole();
      if (mode === "multi") ui.tileInk &= 7;
      ui.dirty = true;
      emit("view");
    },
    setBank(set) {
      if (current.activeSet === set) return;
      current.activeSet = set;
      ui.dirty = true;
      emit("view");
    },
    setColor(key, value) {
      current.colors[key] = value;
      ui.dirty = true;
      emit("view");
    },
    setName(name) {
      current.name = name;
      ui.dirty = true;
      emit("chrome");
    },
  };
}
