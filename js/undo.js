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

// UNDO - REDO functionality
//
// API
//
// name: name of action: Draw, Move, Rotate, Zoom, Erase, Clear, New Frame, Copy Frame, Delete Frame, Change Frame
// type: frame or document
//
// pushDocUndo(name, frameTarget, ui.currentFrame(), undoFn, redoFn);
// pushUndo(name, frame, undoFn, redoFn);
// undo(frame); pops the relevant undo stack
// redo(frame); pops the relevant redo stack
// clear(); // reset, i.e., when a new document is created
//
// Use events for enabling/disabling buttons and changing button labels
// Events: listen(document, 'jitter-undo-change', handler);
// function undoHandler(evt){
//   evt.detail.frameUndo = nameOfFrameUndo or null;
//   evt.detail.frameRedo = nameOfFrameRedo or null;
//   evt.detail.docUndo = nameOfDocUndo or null;
//   evt.detail.docRedo = nameOfDocRedo or null;
// }

import { sendEvent } from "/jitter/js/dom.js";
import ui from "/jitter/js/ui.js";
const undoStack = new Map();
const redoStack = new Map();

const clear = () => {
  undoStack.clear();
  redoStack.clear();
};

const getUndoStack = frame => {
  let stack = undoStack.get(frame);
  if (!stack) {
    stack = [];
    undoStack.set(frame, stack);
  }
  return stack;
};

const getRedoStack = frame => {
  let stack = redoStack.get(frame);
  if (!stack) {
    stack = [];
    redoStack.set(frame, stack);
  }
  return stack;
};

// top // look at the top item of a stack
const top = stack => (stack.length ? stack[stack.length - 1].name : null);

const topUndo = frame => {
  let stack = getUndoStack(frame);
  return stack ? top(stack) : null;
};

const topRedo = frame => {
  let stack = getRedoStack(frame);
  return stack ? top(stack) : null;
};

const sendUndoEvent = frame =>
  sendEvent("jitter-undo-change", {
    frameUndo: topUndo(frame),
    frameRedo: topRedo(frame),
  });

const pushDocUndo = (name, targetFrame, newCurrentFrame, undoFn, redoFn) => {
  // Special handling for particular events
  if (name === "Delete Frame") {
    let oldUndo = undoFn;
    undoFn = function () {
      oldUndo();
      sendUndoEvent(targetFrame);
    };
    ui.popup("You deleted a frame <button>Undo</button>", undoFn);
  }
  sendUndoEvent(newCurrentFrame);
};

const pushUndo = (name, frame, undoFn, redoFn) => {
  getUndoStack(frame).push({ name, undoFn, redoFn });
  getRedoStack(frame).length = 0;
  sendUndoEvent(frame);
};

const undo = frame => {
  let action = getUndoStack(frame).pop();
  action.undoFn();
  getRedoStack(frame).push(action);
  sendUndoEvent(frame);
};

const redo = frame => {
  let action = getRedoStack(frame).pop();
  action.redoFn();
  getUndoStack(frame).push(action);
  sendUndoEvent(frame);
};

// clear buttons on when new doc is created
sendUndoEvent(null);

export { undo, redo, pushUndo, pushDocUndo, sendUndoEvent as update, clear };
