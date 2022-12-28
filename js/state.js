/* Maintenance of state, file formats, etc. go here */
/* All state functions that directly read from or modify the DOM should be split, we can keep all state in JS data,
   and sync the DOM to that */
/* All state functions that are event handlers should likewise be split. Event handling can go in script.js or if needed we can create an event.js. State functions should only update the JS state */

import palettes from "/jitter/js/palettes.js";

let values = {
  _dirty: false,
  name: "untitled",
  tool: "pen",
  display: "drawingboard",
  strokeWidth: 1,
  eraserWidth: 5,
  doOnionskin: true,
  showVideo: true,
  fps: 10,
  _frameDelay: 100,
  palette: "Primary",
  color: "#000000",
  bgcolor: "transparent",
  color1: "#FF0000",
  color2: "#FFFF00",
  color3: "#00FF00",
  color4: "#00FFFF",
  color5: "#0000FF",
  color6: "#666666",
  color7: "#000000",
  color8: "#FFFFFF",
  display: "drawingboard",
  fileTab: false,
  drawTab: true,
  framesTab: false,
  animateTab: false,
};

// function toggleOnionSkin() {
//   state.doOnionskin = !state.doOnionskin;
// }

// function toggleShowVideo(){
//   state.showVideo = !state.showVideo;
// }

function bool(val) {
  if (val === "false") {
    return false;
  }
  return !!val;
}

class state {
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

  static get tool() {
    return values.tool;
  }

  static set tool(val) {
    values.tool = val;
    values._dirty = true;
  }

  static get display() {
    return values.display;
  }

  static set display(val) {
    values.display = val;
    values._dirty = true;
  }

  static get strokeWidth() {
    return values.strokeWidth;
  }

  static set strokeWidth(val) {
    let theVal = parseInt(val, 10);
    if (theVal > 0) {
      values.strokeWidth = theVal;
    }
    values._dirty = true; // reset if someone types in an invalid value
  }

  static get eraserWidth() {
    return values.eraserWidth;
  }

  static set eraserWidth(val) {
    let theVal = parseInt(val, 10);
    if (theVal > 0) {
      values.eraserWidth = theVal;
    }
    values._dirty = true;
  }

  static get doOnionskin() {
    return values.doOnionskin;
  }

  static set doOnionskin(val) {
    values.doOnionskin = bool(val);
    values._dirty = true;
  }

  static toggleOnionskin() {
    console.log("toggleOnionskin");
    values.doOnionskin = !values.doOnionskin;
    values._dirty = true;
  }

  static get showVideo() {
    return values.showVideo;
  }

  static set showVideo(val) {
    values.showVideo = bool(val);
    values._dirty = true;
  }

  static toggleShowVideo() {
    console.log("toggleShowVideo");
    values.showVideo = !values.showVideo;
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

  static get palette() {
    return values.palette;
  }

  static set palette(val) {
    // Catch some earlier save values
    if (Number.isInteger(val) || Number.isInteger(Number(val))) {
      val = "Primary";
    }
    const palette = palettes.filter(p => p.name === val)[0];
    this.color1 = palette.colors[0];
    this.color2 = palette.colors[1];
    this.color3 = palette.colors[2];
    this.color4 = palette.colors[3];
    this.color5 = palette.colors[4];
    values.palette = val;
    values._dirty = true;
  }

  static get color() {
    return values.color;
  }

  static set color(val) {
    values.color = val;
    values._dirty = true;
  }

  static get bgcolor() {
    return values.bgcolor;
  }

  static set bgcolor(val) {
    values.bgcolor = val;
    values._dirty = true;
  }

  static get color1() {
    return values.color1;
  }

  static set color1(val) {
    values.color1 = val;
    values._dirty = true;
  }

  static get color2() {
    return values.color2;
  }

  static set color2(val) {
    values.color2 = val;
    values._dirty = true;
  }

  static get color3() {
    return values.color3;
  }

  static set color3(val) {
    values.color3 = val;
    values._dirty = true;
  }

  static get color4() {
    return values.color4;
  }

  static set color4(val) {
    values.color4 = val;
    values._dirty = true;
  }

  static get color5() {
    return values.color5;
  }

  static set color5(val) {
    values.color5 = val;
    values._dirty = true;
  }

  static get color6() {
    return values.color6;
  }

  static set color6(val) {
    values.color6 = val;
    values._dirty = true;
  }

  static get color7() {
    return values.color7;
  }

  static set color7(val) {
    values.color7 = val;
    values._dirty = true;
  }

  static get color8() {
    return values.color8;
  }

  static set color8(val) {
    values.color8 = val;
    values._dirty = true;
  }

  static get fileTab() {
    return values.fileTab;
  }

  static set fileTab(val) {
    values.fileTab = bool(val);
    values._dirty = true;
  }

  static get drawTab() {
    return values.drawTab;
  }

  static set drawTab(val) {
    values.drawTab = bool(val);
    values._dirty = true;
  }

  static get framesTab() {
    return values.framesTab;
  }

  static set framesTab(val) {
    values.framesTab = bool(val);
    values._dirty = true;
  }

  static get animateTab() {
    return values.animateTab;
  }

  static set animateTab(val) {
    values.animateTab = bool(val);
    values._dirty = true;
  }
}

export default state;
