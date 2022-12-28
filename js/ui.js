/* Functions specifically to manipulate the DOM go here */

import * as dom from "/jitter/js/dom.js";
const { $, $$, sendEvent } = dom;
import SVGCanvas from "/jitter/js/svgcanvas.js";
import state from "/jitter/js/state.js";
import palettes from "/jitter/js/palettes.js";
import * as tool from "/jitter/js/tool.js";
import Mess from "/jitter/lib/mess.js";

import KellyColorPicker from "/jitter/lib/html5-color-picker.js";

const mess = new Mess(); // toast-style popups, exposed as ui.popup()

// polyfill for dialog
const dialog = $$("dialog").forEach(dialog =>
  dialogPolyfill.registerDialog(dialog)
);

const enablePenSize = flag => {
  $(".feedback.pensize").removeAttribute("hidden");
  $(".feedback.erasersize").setAttribute("hidden", "");
  // This in enablePenSize, but not in enableEraserSize because some tools flip UI to penSize, but it isn't relevant to the tool
  $$(".pensize .stepper > *").forEach(d => (d.disabled = !flag));
};

const enableEraserSize = () => {
  $(".feedback.erasersize").removeAttribute("hidden");
  $(".feedback.pensize").setAttribute("hidden", "");
};

// Initialized palettes
const colorpaletteselect = document.querySelector(".palettechooser");
palettes.forEach((p, i) => {
  colorpaletteselect.append(dom.html("option", { value: p.name }, p.name));
});

// Color picker
const colorpicker = new KellyColorPicker({
  place: $(".popup-color"),
  // input: ".js-color",
  size: 200,
  color: "#ffffff",
  method: "square",
  inputColor: false,
  inputFormat: "mixed",
  alpha: 1,
  alphaSlider: false,
  colorSaver: false,
  resizeWith: true, // auto redraw canvas on resize window
  popupClass: "popup-color",
  userEvents: {
    change: function (self) {
      if (!self.input) {
        // we're initializing but don't have a colorwell yet, ignore
        return;
      }
      state[self.input.id] = self.getCurColorHex();
      if (self.input.id !== "bgcolor") {
        state.color = self.getCurColorHex();
      }
    },
  },
});

function setPaletteHandler(evt) {
  const sel = evt.target;
  state.palette = sel.value;
  sel.blur();
}
setPaletteHandler({ target: colorpaletteselect });

function compareColorButton(button, color) {
  switch (color[0]) {
    case "r":
      return button.value === color;
    case "#":
      return button.value === color;
    default:
      return button.value === `#${color}`;
  }
}

function colorButton(button, color) {
  switch (color[0]) {
    case "r":
      break; // rgb()
    case "#":
      break; // #RRGGBB
    default:
      color = `#${color}`; // add missing #
  }
  button.value = color;
  button.style.backgroundColor = color;
  if (hexToValue(color) < 0.5) {
    button.style.color = "#FFF";
  } else {
    button.style.color = "#000";
  }
}

function hexToValue(hex) {
  return colorpicker.rgbToHsv(colorpicker.hexToRgb(hex)).v;
}

function selectTool(name) {
  let sel = $("#toolpicker");
  ui.currentTool = tools[name];
  ui.currentTool.select();
  switch (name) {
    case "pen":
      enablePenSize(true);
      sel.selectedIndex = 0;
      break;
    case "move":
      enablePenSize(false);
      sel.selectedIndex = 2;
      break;
    case "rotate":
      enablePenSize(false);
      sel.selectedIndex = 1;
      break;
    case "zoomin":
      enablePenSize(false);
      sel.selectedIndex = 3;
      break;
    case "zoomout":
      enablePenSize(false);
      sel.selectedIndex = 4;
      break;
    case "eraser":
      enableEraserSize();
      sel.selectedIndex = 5;
      break;
    default:
      console.error("unrecognized tool name: %s", name);
  }
}

function displayAsStoryboard() {
  let frames = ui.animationToImages();
  frames.forEach(f => document.body.appendChild(f));
  document.body.classList.add("storyboard");
  ui.doc.style.display = "none";
}

function displayAsDrawingboard() {
  $$(".storyboard-frame").map(f => f.remove());
  document.body.classList.remove("storyboard");
  ui.doc.style.display = "block";
}

let aboutJitterDialog = $("#aboutJitter");
let shortcutsDialog = $("#shortcutsDialog");
let currentDisplay = "drawingboard";

/* source: https://stackoverflow.com/a/35970186 */
function invertColor(hex, bw) {
  if (hex.indexOf("#") === 0) {
    hex = hex.slice(1);
  }
  // convert 3-digit hex to 6-digits.
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length !== 6) {
    throw new Error("Invalid HEX color.");
  }
  var r = parseInt(hex.slice(0, 2), 16),
    g = parseInt(hex.slice(2, 4), 16),
    b = parseInt(hex.slice(4, 6), 16);
  if (bw) {
    // https://stackoverflow.com/a/3943023/112731
    return r * 0.299 + g * 0.587 + b * 0.114 > 186 ? "#000000" : "#FFFFFF";
  }
  // invert color components
  r = (255 - r).toString(16);
  g = (255 - g).toString(16);
  b = (255 - b).toString(16);
  // pad each with zeros and return
  return "#" + padZero(r) + padZero(g) + padZero(b);
}

function padZero(str, len) {
  len = len || 2;
  var zeros = new Array(len).join("0");
  return (zeros + str).slice(-len);
}

function drawPenToCanvas() {
  const width = 32;
  const height = 32;
  const radius = state.strokeWidth / 2;
  let cursor = $("canvas.cursor");
  let ctx = cursor.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = state.color;
  ctx.strokeStyle = invertColor(state.color, true);
  ctx.strokeWidth = 1;
  ctx.beginPath();
  ctx.ellipse(width / 2, height / 2, radius, radius, 0, 0, Math.PI * 2, false);
  ctx.fill();
  ctx.stroke();
  dom.sendEvent("changePen", { url: `url(${cursor.toDataURL()})` });
}

let checkerboard;

function initCheckerboard() {
  checkerboard = dom.html("canvas", { width: 32, height: 32 });
  const ctx = checkerboard.getContext("2d");
  const width = 32;
  const height = 32;
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "white";
  for (let x = 0; x < width / 2; x++) {
    for (let y = 0; y < height / 2; y++) {
      if (y % 2 === 0) {
        if (x % 2 === 0) {
          ctx.fillRect(x * 2, y * 2, 2, 2);
        }
      } else {
        if (x % 2 !== 0) {
          ctx.fillRect(x * 2, y * 2, 2, 2);
        }
      }
    }
  }
}

function drawEraserToCanvas() {
  if (!checkerboard) {
    initCheckerboard();
  }
  const width = 32;
  const height = 32;
  const radius = state.eraserWidth / 2;
  let cursor = $("canvas.cursor");
  let ctx = cursor.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  // Can we have a fill style of checkerboard?
  ctx.strokeStyle = "green";
  ctx.strokeWidth = 1;
  ctx.beginPath();
  ctx.ellipse(width / 2, height / 2, radius, radius, 0, 0, Math.PI * 2, false);
  ctx.save();
  ctx.clip();
  ctx.drawImage(checkerboard, 0, 0);
  ctx.restore();
  ctx.stroke();
  dom.sendEvent("changeEraser", { url: `url(${cursor.toDataURL()})` });
}

class ui {
  static doc = $("#doc");

  static showAbout(timeout) {
    aboutJitterDialog.showModal();
    if (timeout && !Number.isNaN(Number(timeout))) {
      setTimeout(aboutJitterDialog.close, timeout);
    }
  }

  static showShortcuts() {
    aboutJitterDialog.close();
    shortcutsDialog.showModal();
  }

  static toggleDisplay(evt) {
    evt.preventDefault();
    evt.stopPropagation();
    if (state.display === "drawingboard") {
      state.display = "storyboard";
    } else {
      state.display = "drawingboard";
    }
  }

  static set display(name) {
    if (name === "storyboard") {
      displayAsStoryboard();
    } else {
      displayAsDrawingboard();
    }
  }

  static startSpinner() {
    $("#jitter i").classList.add("spinning");
  }

  static stopSpinner() {
    $("#jitter i").classList.remove("spinning");
  }

  static toggleUI() {
    document.body.classList.toggle("noui");
  }

  static toggleToolbar(name) {
    state[`${name}Tab`] = !state[`${name}Tab`];
  }

  static frameToImage(frame, x, y, width, height, maxHeight) {
    return new SVGCanvas(frame, x, y, width, height, maxHeight).canvas;
  }

  static animationToImages() {
    let { x, y, width, height } = this.getAnimationBBox();
    return $$(".frame").map(frame =>
      ui.frameToImage(frame, x, y, width, height)
    );
  }

  static getBBox(frame) {
    if (frame.classList.contains("selected")) {
      return frame.getBoundingClientRect();
    } else {
      frame.classList.add("selected");
      let box = frame.getBoundingClientRect();
      frame.classList.remove("selected");
      return box;
    }
  }

  static showBBoxes() {
    $$(".frame").forEach(frame =>
      frame.appendChild(ui.rectForBox(ui.paddedBox(ui.getBBox(frame))))
    );
  }

  static hideBBoxes() {
    let boxes = $$(".guidebox");
    boxes.forEach(box => box.remove());
  }

  // get a red SVG rect for a frame
  static rectForBox(box) {
    return dom.svg("rect", {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      stroke: "red",
      fill: "none",
      class: "guidebox",
    });
  }

  // return an x,y,right,bottom,width,height with a bit of room around (10px)
  static paddedBox(bbox) {
    let box = {
      x: Math.max(bbox.x - 10, 0),
      y: Math.max(bbox.y - 10, 0),
      right: Math.min(bbox.right + 10, document.body.clientWidth),
      bottom: Math.min(bbox.bottom + 10, document.body.clientHeight),
    };
    box.width = box.right - box.x;
    box.height = box.bottom - box.y;
    return box;
  }

  static unionBoxes(boxes) {
    return {
      x: Math.floor(Math.min(...boxes.map(b => b.x))),
      y: Math.floor(Math.min(...boxes.map(b => b.y))),
      right: Math.floor(Math.max(...boxes.map(b => b.right))),
      bottom: Math.floor(Math.max(...boxes.map(b => b.bottom))),
    };
  }

  static getAnimationBBox(show) {
    let frames = $$(".frame");
    let boxes = frames.map(ui.getBBox);
    let box = ui.paddedBox(ui.unionBoxes(boxes));
    if (show) {
      insertAfter(ui.rectForBox(box), ui.currentFrame());
    }
    return box;
  }

  static updateFrameCount() {
    try {
      let frames = $$(".frame");
      let index = frames.indexOf(this.currentFrame());
      state.currentFrame = index; // 0-based index for both frames and timeline thumbnails
      $(".framecount output").textContent = index + 1 + " of " + frames.length;
    } catch (e) {
      // wait for the file to load, probably
    }
  }

  static resize() {
    window.WIDTH = document.body.clientWidth;
    window.HEIGHT = document.body.clientHeight;
    ui.doc.setAttribute("width", window.WIDTH + "px");
    ui.doc.setAttribute("height", window.HEIGHT + "px");
  }

  // Render state as needed
  static set name(val) {
    $("#filename").value = val;
    document.title = "Jitter: " + val;
  }

  static _oldtool;

  static set tool(val) {
    if (val !== this._oldtool) {
      this._oldtool = val;
      selectTool(val);
    }
  }

  static set strokeWidth(val) {
    $("#pensize").value = val;
    drawPenToCanvas();
  }

  static set eraserWidth(val) {
    $("#erasersize").value = val;
    drawEraserToCanvas();
  }

  static set doOnionskin(val) {
    $("#doonionskin").checked = val;
    if (val) {
      dom.addClass(dom.previous(ui.currentFrame(), ".frame"), "onionskin");
    } else {
      $$(".frame.onionskin").forEach(frame =>
        frame.classList.remove("onionskin")
      );
    }
  }

  static set showVideo(val) {
    $("#doshowvideo").checked = val;
    let video = $("#video");
    let capture = $("#framenew");
    if (val) {
      video.removeAttribute("hidden");
      capture.removeAttribute("hidden");
    } else {
      video.setAttribute("hidden", "hidden");
      capture.setAttribute("hidden", "hidden");
    }
  }

  static set fps(val) {
    $("#framerate").value = val;
  }

  static set palette(val) {
    $$("#colorpalette option").forEach(o => {
      if (o.value === val) {
        o.selected = true;
      }
    });
  }

  static isColorPopupVisible = false;

  static hideColorPopup() {
    this.isColorPopupVisible = false;
    $(".popup-color").style.display = "none";
  }

  static showColorPopup(input) {
    this.isColorPopupVisible = true;
    colorpicker.input = input;
    colorpicker.setColor(input.value);
    $(".popup-color").style.display = "block";
  }

  static selectColor(input) {
    if (this.isColorPopupVisible) {
      colorpicker.input = input;
      colorpicker.setColor(input.value);
    }
    state.color = input.value;
  }

  static set color(color) {
    let button = $("#color");
    if (!compareColorButton(button, color)) {
      colorButton(button, color);
      drawPenToCanvas();
      sendEvent("colorChanged");
    }
  }

  static set bgcolor(color) {
    colorButton($("#bgcolor"), color);
    // this.doc.style.backgroundColor = color;
  }

  static set color1(color) {
    colorButton($("#color1"), color);
  }
  static set color2(color) {
    colorButton($("#color2"), color);
  }
  static set color3(color) {
    colorButton($("#color3"), color);
  }
  static set color4(color) {
    colorButton($("#color4"), color);
  }
  static set color5(color) {
    colorButton($("#color5"), color);
  }
  static set color6(color) {
    colorButton($("#color6"), color);
  }
  static set color7(color) {
    colorButton($("#color7"), color);
  }
  static set color8(color) {
    colorButton($("#color8"), color);
  }

  static set fileTab(flag) {
    if (flag) {
      $("#file-toolbar").classList.add("active");
    } else {
      $("#file-toolbar").classList.remove("active");
    }
  }

  static set drawTab(flag) {
    if (flag) {
      $("#draw-toolbar").classList.add("active");
    } else {
      $("#draw-toolbar").classList.remove("active");
    }
  }

  static set framesTab(flag) {
    if (flag) {
      $("#frames-toolbar").classList.add("active");
    } else {
      $("#frames-toolbar").classList.remove("active");
    }
  }
  static set animateTab(flag) {
    // in process of removing this ribbon
  }
  static currentFrame() {
    let frame = $(".frame.selected");
    if (!frame) {
      frame = dom.svg("g", { class: "frame selected" });
      ui.doc.insertBefore(frame, ui.doc.firstElementChild);
    }
    return frame;
  }

  static currentOnionskinFrame() {
    return $(".frame.onionskin");
  }

  static popup(html, fn) {
    mess.showHtml(html, fn);
  }

  static setPaletteHandler = setPaletteHandler;
  static currentTool = null;
}

if (!ui.doc) {
  ui.doc = dom.svg("svg");
  ui.doc.id = "doc";
  document.body.prepend(ui.doc);
}

let tools = {
  pen: new tool.Pen(ui.doc),
  move: new tool.Move(ui.doc),
  rotate: new tool.Rotate(ui.doc),
  zoomin: new tool.ZoomIn(ui.doc),
  zoomout: new tool.ZoomOut(ui.doc),
  eraser: new tool.Eraser(ui.doc),
};
// FIXME move tools to script?
ui.tools = tools;
ui.tool = "pen";

export default ui;
