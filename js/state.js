/* Maintenance of state, file formats, etc. go here */
/* All state functions that directly read from or modify the DOM should be split, we can keep all state in JS data,
   and sync the DOM to that */
/* All state functions that are event handlers should likewise be split. Event handling can go in script.js or if needed we can create an event.js. State functions should only update the JS state */

let values = {
  _dirty: false,
  name: "untitled",
  display: "drawingboard",
  doonionskin: true,
  showvideo: true,
  fps: 10,
  _frameDelay: 100,
  display: "drawingboard",
  filetab: false,
  framestab: true,
};

function bool(val) {
  if (val === "false") {
    return false;
  }
  return !!val;
}

class state {
  // NOTE: state values should be lowercase to avoid problems serializing and restoring them
  static get keys() {
    return Object.keys(values).filter(key => key[0] !== "_");
  }

  static clearDirtyFlag() {
    // Should only be called by render()
    values._dirty = false;
  }

  static get dirty() {
    return values._dirty;
  }

  static get name() {
    return values.name;
  }

  static set name(val) {
    values.name = val;
    values._dirty = true;
  }

  static get display() {
    return values.display;
  }

  static set display(val) {
    values.display = val;
    values._dirty = true;
  }

  static get doonionskin() {
    return values.doonionskin;
  }

  static set doonionskin(val) {
    values.doonionskin = bool(val);
    values._dirty = true;
  }

  static toggleonionskin() {
    values.doonionskin = !values.doonionskin;
    values._dirty = true;
  }

  static get showvideo() {
    return values.showvideo;
  }

  static set showvideo(val) {
    values.showvideo = bool(val);
    values._dirty = true;
  }

  static toggleshowvideo() {
    values.showvideo = !values.showvideo;
    values._dirty = true;
  }

  static get fps() {
    return values.fps;
  }

  static set fps(val) {
    let newVal = Number(val);
    if (Number.isNaN(newVal) || newVal < 1) {
      return;
    }
    values.fps = newVal;
    values._frameDelay = 1000 / newVal;
    values._dirty = true;
  }

  static get frameDelay() {
    return values._frameDelay;
  }

  static get filetab() {
    return values.filetab;
  }

  static set filetab(val) {
    values.filetab = bool(val);
    values._dirty = true;
  }

  static get framestab() {
    return values.framestab;
  }

  static set framestab(val) {
    values.framestab = bool(val);
    values._dirty = true;
  }
}

export default state;
