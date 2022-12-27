/***************************************
 *
 *  MANAGE FRAMES
 *
 ***************************************/

import state from "/jitter/js/state.js";
import ui from "/jitter/js/ui.js";
import * as dom from "/jitter/js/dom.js";
const { $, $$ } = dom;
import * as undo from "/jitter/js/undo.js";

function updateOnionskin() {
  if (!state.doOnionskin) return;
  $$(".frame.onionskin").forEach(frame => frame.classList.remove("onionskin"));
  dom.addClass(dom.previous(ui.currentFrame(), ".frame"), "onionskin");
}

function insertFrame(before, frame) {
  dom.insertAfter(frame, before);
  frame.id = dom.randomId();
  dom.sendEvent("addFrame", {frame});
  return frame;
}

function addFrame() {
  let curr = ui.currentFrame();
  let frame = insertFrame(curr, dom.svg("g", { class: "frame" }));
  goToFrame(curr, frame);
}

function cloneFrame() {
  let curr = ui.currentFrame();
  let frame = insertFrame(curr, curr.cloneNode(true));
  goToFrame(curr, frame);
}

function deleteFrame(suppressUndo) {
  let frameToDelete = ui.currentFrame();
  if (frameToDelete.nextElementSibling) {
    incrementFrame(true);
  } else if (frameToDelete.previousElementSibling) {
    decrementFrame(true);
  }
  let curr = ui.currentFrame();
  let parent = frameToDelete.parentNode;
  let next = frameToDelete.nextElementSibling;
  if (frameToDelete.parentNode.children.length > 1) {
    dom.remove(frameToDelete);
    dom.sendEvent("removeFrame", {frame: frameToDelete});
    if (!suppressUndo) {
      undo.pushDocUndo(
        "Delete Frame",
        frameToDelete,
        curr,
        () => {
          parent.insertBefore(frameToDelete, next);
          dom.sendEvent("addFrame", {frame: frameToDelete});
          goToFrame(curr, frameToDelete);
        },
        () => deleteFrame(true)
      );
    }
    goToFrame(frameToDelete, curr);
  }
}

function restore(frame, children, transform) {
  if (transform) {
    frame.setAttribute("transform", transform);
  }
  children.forEach(child => frame.appendChild(child));
  dom.sendEvent("updateFrame", {frame});
  return frame;
}

function clearFrame(frame) {
  if (!frame) {
    frame = ui.currentFrame();
  }
  let oldTransform = frame.getAttribute("transform") || "";
  let children = [...frame.children];
  dom.clear(frame);
  dom.sendEvent("updateFrame", {frame});
  undo.pushUndo(
    "Clear",
    frame,
    () => restore(frame, children, oldTransform),
    () => clearFrame(frame)
  );
}

function goToFrame(prev, next) {
  if (prev === next) {
    // Trying to go to frame that is already selected
    console.warn("next frame is already selected");
    return;
  }
  if (!next) {
    // How the hell can this happen?
    console.error("there is no next frame????");
    return;
  }
  $$(".frame.selected").forEach(elem => elem.classList.remove("selected"));
  next.classList.add("selected");
  dom.sendEvent("selectFrame", {frame:next});
  updateOnionskin();
  ui.updateFrameCount();
  undo.update(next);
}

function incrementFrame() {
  let curr = ui.currentFrame();
  let next = dom.next(curr, ".frame");
  if (next) {
    goToFrame(curr, next);
  }
}

function decrementFrame() {
  let curr = ui.currentFrame();
  let prev = dom.previous(curr, ".frame");
  if (prev) {
    goToFrame(curr, prev);
  }
}

function goToFirstFrame() {
  let curr = ui.currentFrame();
  let first = $(".frame");
  goToFrame(curr, first);
}

function goToLastFrame() {
  const curr = ui.currentFrame();
  const last = $(".frame:last-child");
  goToFrame(curr, last);
}

window.goToFrame = goToFrame;

export {
  insertFrame,
  addFrame,
  cloneFrame,
  deleteFrame,
  clearFrame,
  goToFrame,
  incrementFrame,
  decrementFrame,
  goToFirstFrame,
  goToLastFrame,
  updateOnionskin,
};
