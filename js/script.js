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
import * as timeline from "/jitter/js/timeline.js";
import * as camera from "/jitter/js/camera.js";
import GIF from "/jitter/lib/gif.js";
import JSZip from "/jitter/lib/jszip.min.js";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/jitter/sw.js", { scope: "/jitter/" });
}

// Wrap `dom.listen` and `dom.addShortcuts` so that events don't trigger during animation playback

function listen(selector, event, listener) {
  if (typeof listener !== "function") {
    console.error("Expected function, received %s", typeof listener);
  }
  dom.listen(selector, event, evt => {
    if (!state.playing) {
      listener(evt);
    }
  });
}

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

const defaultDoc = `<svg id="doc" width="2560px" height="1116px" data-name="untitled" data-doonionskin="true" data-showvideo="true" data-fps="10" data-filetab="false" data-framestab="true"></svg>`;

let body = document.body;

listen(window, "updateFrame", evt =>
  timeline.updateThumbnail(evt.detail.frame)
);

/* FILE Functions */

function newAnimation(evt) {
  let forSure = confirm(
    "This will delete your current document, be sure to save first. Delete and start a new document?"
  );
  if (forSure) {
    clear();
  }
}

function restoreFormat(savetext) {
  if (!savetext) {
    savetext = defaultDoc;
  }
  if (!ui.doc) {
    console.warn("ui doc not found in restoreFormat, doc may be detached");
    ui.doc = dom.svg("svg");
  }
  ui.doc.outerHTML = savetext;
  ui.doc = $("#doc");
  // console.log("ui doc re-established after restoring: %s", !!ui.doc);
  ui.updateFrameCount();
  dom.ensureIds(".frame");
  ui.resize();
  restoreSavedState();
  // could clear thumbnails if there are no frames
  timeline.makeThumbnails();
}

function restoreLocal() {
  restoreFormat(localStorage._currentWork || defaultDoc);
}

function clear() {
  restoreFormat(defaultDoc);
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
  if (ui.doc) {
    updateSavedState();
    if (ui.doc.id === "canvas") {
      ui.doc.id = "doc";
    }
    $$(doc, "g").forEach(g => {
      if (!g.hasChildNodes()) {
        g.remove();
      }
    });
    return ui.doc.outerHTML;
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
    background: "#FFFFFF",
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
  // FIXME, these should not be hardcoded
  let width = 640;
  let height = 480;
  let frames = $$(".frame");
  let canvas = dom.html("canvas", {
    width: width,
    height: height * frames.length,
  });
  let ctx = canvas.getContext("2d");
  frames.forEach((frame, idx) => {
    let img = ui.frameToImage(frame);
    img.decode().then(() => ctx.drawImage(img, 0, height * idx));
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
      // FIXME, frame contains an image already, use that?
      ui.frameToImage(frame).toBlob(blob => resolve(blob))
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
  state.keys.forEach(key => (ui.doc.dataset[key] = state[key]));
}

function restoreSavedState() {
  Object.keys(ui.doc.dataset).forEach(
    key => (state[key] = ui.doc.dataset[key])
  );
  // state.keys.forEach(key => (state[key] = ui.doc.dataset[key]));
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

/* Initialize camera */
camera.initialize("video");

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
// Files
addShortcuts("n", newAnimation, "#filenew", "n", "n");
addShortcuts("⌘+s, ctrl+s", saveAsSvg, "#filesave", "⌘+s", "⌃+s");
addShortcuts("⌘+o, ctrl+o", openSvg, "#fileopen", "⌘+o", "⌃+o");
addShortcuts("g", saveAsGif, "#filegif", "g", "g");
addShortcuts("p", saveAsSpritesheet, "#filepng", "p", "p");
addShortcuts("z", saveAsZip, "#filezip", "z", "z");
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
addShortcuts("shift+left", frames.goToFirstFrame, "#framefirst", "⇧+←", "⇧+←");
addShortcuts("left", frames.decrementFrame, "#frameprev", "←", "←");
addShortcuts("right", frames.incrementFrame, "#framenext", "→", "→");
addShortcuts("shift+right", frames.goToLastFrame, "#framelast", "⇧+→", "⇧+→");
addShortcuts("k", state.toggleOnionskin, "#doonionskin", "k", "k");
addShortcuts("r", animation.play, "animateplay", "r", "r");

// Promote number inputs to steppers
$$("input[type=number]").forEach(stepper.upgrade);

// EVENT HANDLERS

// UI Events
listen("#jitter", "click", ui.toggleUI);
listen("#about", "click", ui.showAbout);
listen("#file", "click", evt => ui.toggleToolbar(evt.currentTarget.id));
listen("#filename", "change", evt => (state.name = $("#filename").value));
listen("#filenew", "click", newAnimation);
listen("#fileopen", "click", openSvg);
listen("#filesave", "click", saveAsSvg);
listen("#filegif", "click", saveAsGif);
listen("#filepng", "click", saveAsSpritesheet);
listen("#filezip", "click", saveAsZip);
listen("#save-moat", "click", saveToMoat);
listen(".framerate .stepper-add-button", "click", evt => {
  state.fps += 1;
});
listen(".framerate .stepper-remove-button", "click", evt => {
  state.fps -= 1;
});
listen(
  "#framerate",
  "click",
  evt => (state.frameRate = Number(evt.currentTarget.value))
);
listen("#frames", "click", evt => ui.toggleToolbar(evt.currentTarget.id));
listen("#framedelete", "click", evt => frames.deleteFrame());
listen("#framenew", "click", frames.addFrame);
listen("#framefirst", "click", frames.goToFirstFrame);
listen("#frameprev", "click", frames.decrementFrame);
listen("#framenext", "click", frames.incrementFrame);
listen("#framelast", "click", frames.goToLastFrame);
listen("#doonionskin", "change", state.toggleonionskin);
listen(".onionskin > i", "click", state.toggleonionskin);
listen("#doshowvideo", "change", state.toggleshowvideo);
listen(".showvideo > i", "click", state.toggleshowvideo);
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
listen(document, "addFrame", evt => {
  ui.currentFrame().appendChild(camera.svgSnapshot());
});
listen(document, "addFrame", evt => timeline.addThumbnail(evt.detail.frame));
listen(document, "removeFrame", evt =>
  timeline.removeThumbnail(evt.detail.frame)
);
listen(document, "selectFrame", evt =>
  timeline.selectThumbnail(evt.detail.frame)
);
