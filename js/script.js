// Copyright (C) 2020 Dethe Elza

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

/* globals  key */

import * as file from "/jitter/js/file.js";
import state from "/jitter/js/state.js";
import ui from "/jitter/js/ui.js";
import * as frames from "/jitter/js/frames.js";
import * as dom from "/jitter/js/dom.js";
const { $, $$, sendEvent } = dom;
import * as animation from "/jitter/js/animation.js";
import * as stepper from "/jitter/js/stepper.js";
import * as undo from "/jitter/js/undo.js";
import * as timeline from "/jitter/js/timeline.js";
import GIF from "/jitter/lib/gif.js";
import JSZip from "/jitter/lib/jszip.min.js";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/jitter/sw.js", { scope: "/jitter/" });
}

// Wrap `dom.listen` and `dom.addShortcuts` so that events don't trigger during animation playback

const listen = (selector, event, listener) =>
  dom.listen(selector, event, evt => {
    if (!state.playing) {
      listener(evt);
    }
  });
const addShortcuts = (shortcuts, fn, uxid, macHint, pcHint) =>
  dom.addShortcuts(
    shortcuts,
    evt => {
      if (!state.playing) {
        fn(evt);
      }
    },
    uxid,
    macHint,
    pcHint
  );

// for debugging, FIXME
window.ui = ui;
window.state = state;

const defaultCanvas = `<svg id="canvas" width="2560px" height="1116px" data-name="untitled" data-tool="pen" data-strokeWidth="2" data-doOnionskin="true" data-fps="10" data-palette="Primary" data-color="#000000" data-bgcolor="#FFFFFF" data-color1="#FF0000" data-color2="#FFFF00" data-color3="#00FF00" data-color4="#00FFFF" data-color5="#0000FF" data-color6="#666666" data-color7="#000000" data-color8="#FFFFFF" data-fileTab="false" data-drawTab="true" data-framesTab="true" data-animateTab="false"><g class="frame selected"></g></svg>`;

function getSvgPoint(x, y) {
  let point = $("svg").createSVGPoint();
  point.x = x;
  point.y = y;
  return point;
}

function selectToolHandler(sel) {
  state.tool = sel.value;
  sel.blur();
}

// select the Pen tool if the color changes
listen(document, "colorChanged", evt => (state.tool = "pen"));

// Prevent control clicks from passing through to svg
function swallowClicks(evt) {
  evt.stopPropagation();
  // evt.preventDefault();
}
listen(".toolbar, .tabbar", ["mousedown", "touchstart"], swallowClicks);

const toolStart = evt => ui.currentTool.start(evt);
const toolMove = evt => ui.currentTool.move(evt);
const toolStop = evt => ui.currentTool.stop(evt);
const toolCancel = evt => ui.currentTool.cancel();
const escCancel = evt => {
  if (evt.code && evt.code === "Escape") {
    ui.currentTool.cancel();
    if (ui.isColorPopupVisible) {
      ui.hideColorPopup();
    }
  }
};

listen(document, "changePen", evt => {
  ui.tools.pen.setCursor(evt.detail.url, ui.currentTool === ui.tools.pen);
});

listen(document, "changeEraser", evt => {
  ui.tools.eraser.setCursor(evt.detail.url, ui.currentTool === ui.tools.eraser);
});

let body = document.body;

let toolStartOrHidePopup = evt => {
  if (ui.isColorPopupVisible) {
    ui.hideColorPopup();
  } else {
    toolStart(evt);
  }
};

function listenCanvas() {
  listen(canvas, ["mousedown", "touchstart"], toolStartOrHidePopup);
  listen(canvas, ["mousemove", "touchmove"], toolMove);
  listen(canvas, "touchend", toolStop);
  listen(canvas, "touchcancel", toolCancel);
}

listen(body, "mouseup", toolStop);
listen(window, "keydown", escCancel);

listen(window, "updateFrame", evt =>
  timeline.updateThumbnail(evt.detail.frame)
);

function undoLine() {
  dom.remove(ui.currentFrame().lastElementChild);
}

/* FILE Functions */

function newAnimation(evt) {
  let forSure = confirm(
    "This will delete your current document, be sure to save first. Delete and start a new document?"
  );
  if (forSure) {
    clear();
    ui.updateFrameCount();
    undo.clear();
    timeline.makeThumbnails();
  }
}

function restoreFormat(savetext) {
  if (!savetext) {
    savetext = defaultCanvas;
  }
  ui.canvas.outerHTML = savetext;
  ui.canvas = $("#canvas");
  ui.updateFrameCount();
  dom.ensureIds(".frame");
  ui.resize();
  restoreSavedState();
  listenCanvas();
  timeline.makeThumbnails();
}

function restoreLocal() {
  restoreFormat(localStorage._currentWork || defaultCanvas);
}

function clear() {
  restoreFormat(defaultCanvas);
}

function saveToMoat() {
  let moat = $("#moat");
  if (!moat.value) {
    alert("You have to choose a Moat program first");
    return;
  }
  if (!state.name) {
    state.name = prompt("Save SVG file as: ");
  }
  if (!state.name) {
    return;
  }
  file.sendToMoat(saveFormat(), `${state.name}.svg`, moat.value);
}

function saveFormat() {
  if (ui.canvas) {
    updateSavedState();
    return ui.canvas.outerHTML;
  } else {
    return "";
  }
}

function saveAsSvg(evt) {
  evt.preventDefault();
  if (!state.name || state.name === "untitled") {
    state.name = prompt("Save SVG file as: ");
  }
  if (!state.name) return;
  ui.startSpinner();
  dom.listen(document, "FileSaved", evt => ui.stopSpinner());
  file.save(saveFormat(), state.name);
}

function saveFrameAsPng(evt) {
  // unused, add UI or delete
  let { x, y, width, height } = ui.getAnimationBBox();
  let img = frameToImage(ui.currentFrame(), x, y, width, height);
  // FIXME: save the image
}

function saveAsGif(evt) {
  if (!state.name || state.name === "untitled") {
    state.name = prompt("Save SVG file as: ");
  }
  if (!state.name) return;
  ui.startSpinner();
  let gif = new GIF({
    workers: 2,
    quality: 10,
    workerScript: "lib/gif.worker.js",
    background: $("#bgcolor").value,
  });
  let images = ui.animationToImages();
  images.forEach(img => gif.addFrame(img, { delay: state.frameDelay }));
  gif.on("finished", function (blob) {
    console.info("gif completed");
    file.saveAs(blob, `${state.name}.gif`);
    // window.open(URL.createObjectURL(blob));
  });
  dom.listen(document, "FileSaved", evt => ui.stopSpinner());
  gif.render();
}

function openSvg(evt) {
  file.load(restoreFormat);
}

function saveAsSpritesheet() {
  if (!state.name || state.name === "untitled") {
    state.name = prompt("Save PNG file as: ");
  }
  if (!state.name) return;
  ui.startSpinner();
  let { x, y, width, height } = ui.getAnimationBBox();
  let frames = $$(".frame");
  let canvas = dom.html("canvas", {
    width: width,
    height: height * frames.length,
  });
  let ctx = canvas.getContext("2d");
  frames.forEach((frame, idx) => {
    ctx.drawImage(ui.frameToImage(frame, x, y, width, height), 0, height * idx);
  });
  dom.listen(document, "FileSaved", evt => ui.stopSpinner());
  file.saveAs(canvas, `${state.name}.png`);
}

async function saveAsZip() {
  if (!state.name || state.name === "untitled") {
    state.name = prompt("Save PNG file as: ");
  }
  if (!state.name) return;
  ui.startSpinner();
  let { x, y, width, height } = ui.getAnimationBBox();
  var zip = new JSZip();
  var img = zip.folder(state.name);
  let frames = $$(".frame");
  var digits = frames.length.toString().length;
  const pad = number => number.toString().padStart(digits, "0");
  for (let idx = 0; idx < frames.length; idx++) {
    const frame = frames[idx];
    // add each frame to the zip as a PNG
    let blob = await new Promise(resolve =>
      ui.frameToImage(frame, x, y, width, height).toBlob(blob => resolve(blob))
    );
    img.file(state.name + pad(idx) + ".png", blob, { base64: true });
  }
  zip.generateAsync({ type: "blob" }).then(function (content) {
    file.saveAs(content, state.name + ".zip");
    ui.stopSpinner();
  });
}

function saveLocal() {
  localStorage._currentWork = saveFormat();
}

function updateSavedState() {
  state.keys.forEach(key => (ui.canvas.dataset[key] = state[key]));
}

function restoreSavedState() {
  state.keys.forEach(key => (state[key] = ui.canvas.dataset[key]));
}

function keydownHandler(evt) {
  if ((evt.key || evt.keyIdentifier) === "Control") {
    document.body.classList.add("usefiles");
  }
}

function keyupHandler(evt) {
  if ((evt.key || evt.keyIdentifier) === "Control") {
    document.body.classList.remove("usefiles");
  }
}

listen(document, "keydown", keydownHandler);
listen(document, "keyup", keyupHandler);

// Attempt to disable default Safari iOS pinch to zoom (failed)

// listen('touchmove', function (event) {
//   if (event.scale !== 1) { event.preventDefault();  event.stopPropagation();}
//   if (event.changedTouches.length > 1){
//     event.preventDefault(); event.stopPropagation();
//   }
// }, false);

// Attempt again to disable default Safari iOS pinch to zoom and replace with our own zoom
function gestureStart(event) {}

function gestureChange(event) {
  // Disable browser zoom
  event.preventDefault();
  // need centre point between fingers to zoom from and amount to zoom
}

function gestureEnd(event) {}

listen(document.documentElement, "gesturestart", gestureStart);
listen(document.documentElement, "gesturechange", gestureChange);
listen(document.documentElement, "gestureed", gestureEnd);

// Disable default Safari iOS double-tap to zoom
var lastTouchEnd = 0;
listen(document, "touchend", function (event) {
  var now = new Date().getTime();
  if (now - lastTouchEnd <= 300) {
    event.preventDefault();
  }
  lastTouchEnd = now;
});

/* Initialize Undo UI */
const undoButtons = {
  frameUndo: $("#frameundo"),
  frameRedo: $("#frameredo"),
};

/* Show current undo options on buttons */
function updateUndo(evt) {
  ["frameUndo", "frameRedo"].forEach(key => {
    if (evt.detail[key]) {
      undoButtons[key].disabled = false;
      undoButtons[key].innerText =
        (key.endsWith("Undo") ? "Undo " : "Redo ") + evt.detail[key];
    } else {
      undoButtons[key].innerText = key.endsWith("Undo") ? "Undo" : "Redo";
      undoButtons[key].disabled = true;
    }
  });
  const frameCount = $$(".frame").length;
  if (frameCount > 1) {
    $("#framedelete").removeAttribute("disabled");
  } else {
    $("#framedelete").setAttribute("disabled", "disabled");
  }
}
listen(document, "jitter-undo-change", updateUndo);

// Show About dialogue the first time someone visits.
if (!localStorage.hasSeenAbout) {
  ui.showAbout(3000);
  localStorage.hasSeenAbout = true;
}

// Show/Hide Timeline

function toggleVisible(element) {
  element.hasAttribute("hidden")
    ? element.removeAttribute("hidden")
    : element.setAttribute("hidden", "hidden");
}

//////////////////////////////////////////////////////////
//
// keyboard shortcuts
//
//////////////////////////////////////////////////////////

function changePenOrEraserSize(evt, handler) {
  let key;
  if (ui.currentTool.name === "pen") {
    key = "strokeWidth";
  } else if (ui.currentTool.name === "eraser") {
    key = "eraserWidth";
  } else {
    return;
  }
  if (handler.shortcut.endsWith("-")) {
    state[key] -= 1;
  } else {
    state[key] += 1;
  }
}

function render() {
  if (state.dirty) {
    state.clearDirtyFlag();
    state.keys.forEach(key => (ui[key] = state[key]));
    frames.updateOnionskin();
  }
  requestAnimationFrame(render);
}

function resize() {
  ui.resize();
  timeline.makeThumbnails();
}

requestAnimationFrame(render);

// Key shortcuts: Command: ⌘
//                Control: ⌃
//                Shift:   ⇧
//              Backspace: ⌫
//                Delete:  ⌦
//                Arrows: ← →

addShortcuts("tab", () => $("#jitter").click(), "#jitter", "tab", "tab");
addShortcuts("d", ui.toggleDisplay, "", "d", "d");
// Undo/Redo
addShortcuts(
  "⌘+z, ctrl+z",
  () => undo.undo(ui.currentFrame()),
  "#frameundo",
  "⌘-z",
  "⌃-z"
);
addShortcuts(
  "shift+⌘+z, ctrl+y",
  () => undo.redo(ui.currentFrame()),
  "#frameredo",
  "⇧+⌘+z",
  "⌃+y"
);
// Files
addShortcuts("n", newAnimation, "#filenew", "n", "n");
addShortcuts("⌘+s, ctrl+s", saveAsSvg, "#filesave", "⌘+s", "⌃+s");
addShortcuts("⌘+o, ctrl+o", openSvg, "#fileopen", "⌘+o", "⌃+o");
addShortcuts("g", saveAsGif, "#filegif", "g", "g");
addShortcuts("p", saveAsSpritesheet, "#filepng", "p", "p");
addShortcuts("z", saveAsZip, "#filezip", "z", "z");
// Tools
addShortcuts("shift+1", () => (state.tool = "pen"), "#toolpen", "⇧+1", "⇧+1");
addShortcuts(
  "shift+2",
  () => (state.tool = "rotate"),
  "#toolrotate",
  "⇧+2",
  "⇧+2"
);
addShortcuts("shift+3", () => (state.tool = "move"), "#toolmove", "⇧+3", "⇧+3");
addShortcuts(
  "shift+4",
  () => (state.tool = "zoomin"),
  "#toolzoomin",
  "⇧+4",
  "⇧+4"
);
addShortcuts(
  "shift+5",
  () => (state.tool = "zoomout"),
  "#toolzoomout",
  "⇧+5",
  "⇧+5"
);
addShortcuts(
  "shift+6",
  () => (state.tool = "eraser"),
  "#tooleraser",
  "⇧+6",
  "⇧+6"
);
addShortcuts(
  "shift+=, =, shift+-, -",
  changePenOrEraserSize,
  "#pensize,#erasersize",
  "+/-",
  "+/-"
);
// TODO: Add zoomin in/out without switching tools
// colors
addShortcuts("1", () => $("#color1").click(), "#color1", "1", "1");
addShortcuts("2", () => $("#color2").click(), "#color2", "2", "2");
addShortcuts("3", () => $("#color3").click(), "#color3", "3", "3");
addShortcuts("4", () => $("#color4").click(), "#color4", "4", "4");
addShortcuts("5", () => $("#color5").click(), "#color5", "5", "5");
addShortcuts("6", () => $("#color6").click(), "#color6", "6", "6");
addShortcuts("7", () => $("#color7").click(), "#color7", "7", "7");
addShortcuts("8", () => $("#color8").click(), "#color8", "8", "8");
// Frames
addShortcuts("shift+n", frames.addFrame, "#framenew", "⇧+n", "⇧+n");
addShortcuts(
  "shift+backspace, shift+delete",
  () => {
    frames.deleteFrame();
  },
  "#framedelete",
  "⇧+⌫",
  "⇧+⌦"
);
addShortcuts("shift+c", () => frames.cloneFrame(), "#framecopy", "⇧+c", "⇧+c");
addShortcuts("shift+x", () => frames.clearFrame(), "#frameclear", "⇧+x", "⇧+x");
addShortcuts("shift+left", frames.goToFirstFrame, "#framefirst", "⇧+←", "⇧+←");
addShortcuts("left", frames.decrementFrame, "#frameprev", "←", "←");
addShortcuts("right", frames.incrementFrame, "#framenext", "→", "→");
addShortcuts("shift+right", frames.goToLastFrame, "#framelast", "⇧+→", "⇧+→");
addShortcuts("k", state.toggleOnionskin, "#doonionskin", "k", "k");
// Animate
addShortcuts("r", animation.play, "animateplay", "r", "r");

// Promote number inputs to steppers
$$("input[type=number]").forEach(stepper.upgrade);

// EVENT HANDLERS

// UI Events
listen(".palettechooser", "change", ui.setPaletteHandler);
listen("#jitter", "click", ui.toggleUI);
listen("#about", "click", ui.showAbout);
listen("#frameundo", "click", evt => undo.undo(ui.currentFrame()));
listen("#frameredo", "click", evt => undo.redo(ui.currentFrame()));
listen("#file", "click", evt => ui.toggleToolbar(evt.currentTarget.id));
listen("#filename", "change", evt => (state.name = $("#filename").value));
listen("#filenew", "click", newAnimation);
listen("#fileopen", "click", openSvg);
listen("#filesave", "click", saveAsSvg);
listen("#filegif", "click", saveAsGif);
listen("#filepng", "click", saveAsSpritesheet);
listen("#filezip", "click", saveAsZip);
listen("#save-moat", "click", saveToMoat);
listen("#draw", "click", evt => ui.toggleToolbar(evt.currentTarget.id));
listen("#toolpicker", "change", evt => selectToolHandler(evt.currentTarget));
listen(
  ".pensize .stepper-add-button",
  "click",
  evt => (state.strokeWidth += 1)
);
listen(
  ".pensize .stepper-remove-button",
  "click",
  evt => (state.strokeWidth -= 1)
);
listen(
  ".erasersize .stepper-add-button",
  "click",
  evt => (state.eraserWidth += 1)
);
listen(
  ".erasersize .stepper-remove-button",
  "click",
  evt => (state.eraserWidth -= 1)
);
listen(
  "#pensize",
  "change",
  evt => (state.strokeWidth = Number(evt.currentTarget.value))
);
listen(
  "#erasersize",
  "change",
  evt => (state.eraserWidth = Number(evt.currentTarget.value))
);
listen(
  ".framerate .stepper-add-button",
  "click",
  evt => (state.frameRate += 1)
);
listen(
  ".framerate .stepper-remove-button",
  "click",
  evt => (state.frameRate -= 1)
);
listen(
  "#framerate",
  "click",
  evt => (state.frameRate = Number(evt.currentTarget.value))
);
listen("#color, #bgcolor", "click", evt =>
  ui.showColorPopup(evt.currentTarget)
);
listen(".miniwell", "click", evt => ui.selectColor(evt.currentTarget));
listen(".miniwell", "dblclick", evt => ui.showColorPopup(evt.currentTarget));
listen("#frames", "click", evt => ui.toggleToolbar(evt.currentTarget.id));
listen("#framedelete", "click", evt => frames.deleteFrame());
listen("#framenew", "click", frames.addFrame);
listen("#framecopy", "click", () => frames.cloneFrame());
listen("#frameclear", "click", () => frames.clearFrame());
listen("#framefirst", "click", frames.goToFirstFrame);
listen("#frameprev", "click", frames.decrementFrame);
listen("#framenext", "click", frames.incrementFrame);
listen("#framelast", "click", frames.goToLastFrame);
listen("#doonionskin", "change", state.toggleOnionskin);
listen(".onionskin > i", "click", state.toggleOnionskin);
listen("#animate", "click", evt => ui.toggleToolbar(evt.currentTarget.id));
listen("#animateplay", "click", animation.play);
listen("#framerate", "change", evt => (state.fps = evt.currentTarget.value));
listen(".timeline-label", "click", timeline.toggleTimeline);
listen("#shortcuts", "click", ui.showShortcuts);
listen(".timeline-frames", "click", evt => {
  if (!evt.target.matches(".canvas-frame")) {
    return;
  }
  frames.goToFrame(ui.currentFrame(), timeline.frameForThumbnail(evt.target));
});
// File Events
listen(window, "unload", saveLocal);
listen(window, "load", restoreLocal);

// Resize events
listen(window, "resize", resize);

// Frame events
listen(document, "addFrame", evt => timeline.addThumbnail(evt.detail.frame));
listen(document, "removeFrame", evt =>
  timeline.removeThumbnail(evt.detail.frame)
);
listen(document, "updateFrame", evt =>
  timeline.updateThumbnail(evt.detail.frame)
);
listen(document, "selectFrame", evt =>
  timeline.selectThumbnail(evt.detail.frame)
);
