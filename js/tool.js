import * as dom from "/jitter/js/dom.js";
const { $, $$, sendEvent } = dom;
import state from "/jitter/js/state.js";
import ui from "/jitter/js/ui.js";
import * as undo from "/jitter/js/undo.js";

const ZOOM_FACTOR = 1000;

const DEG = 180 / Math.PI;
const degrees = rads => rads * DEG;
const radians = degs => degs / DEG;

let currentMatrix;

document.body.appendChild(
  dom.html("canvas", {
    width: "32",
    height: "32",
    hidden: "hidden",
    id: "pencursor",
    class: "cursor",
  })
);

class Pen {
  constructor() {
    this.name = "pen";
    this.drawing = false;
    this.currentPath = null;
    this.prevPoint = null;
    this.cursor = "url(img/pen.svg) 16 16, auto";
  }

  setCursor(url, isCurrent) {
    this.cursor = url;
    if (isCurrent) {
      $("svg").style.cursor = `${url} 16 16, auto`;
    }
  }

  select() {
    $("svg").style.cursor = this.cursor;
  }

  startPath(x, y) {
    // TODO: Change cursor to reflect current color and current stroke width
    let path = dom.svg("path", {
      d: `M${x},${y}`,
      stroke: state.color,
      "stroke-width": state.strokeWidth,
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
      fill: "none",
    });
    this.currentPath = ui.currentFrame().appendChild(path);
  }

  appendToPath(x, y) {
    this.currentPath.setAttribute(
      "d",
      this.currentPath.getAttribute("d") + ` L${x},${y}`
    );
  }

  start(evt) {
    saveMatrix();
    let { x, y, wx, wy, err } = getXY(evt);
    if (err) {
      return;
    }
    this.firstPoint = { x, y };
    this.prevPoint = { x, y };
    this.startPath(x, y);
    this.drawing = true;
    document.body.classList.add("nocontextmenu");
  }

  move(evt) {
    if (!this.drawing) return;
    let { x, y, wx, wy, err } = getXY(evt);
    if (err) {
      return;
    }
    if (collideCircle({ x, y }, 1, this.prevPoint, 1)) {
      // too close to previous point to both drawing
      return;
    }
    this.prevPoint = { x, y };
    if (inBounds(wx, wy)) {
      this.appendToPath(x, y);
    }
  }

  stop(evt) {
    if (!this.drawing) return;
    let { x, y, wx, wy, err } = getXY(evt);
    if (err) {
      return;
    }
    let path = this.currentPath;
    let parent = ui.currentFrame();
    if (path) {
      let { x: sx, y: sy } = this.firstPoint;
      if (inBounds(wx, wy) && sx === x && sy === y) {
        // make a dot if we haven't moved
        this.appendToPath(x, y);
      }
      this.currentPath = null;
    }
    this.drawing = false;
    currentMatrix = null;
    document.body.classList.remove("nocontextmenu");
    undo.pushUndo(
      "Draw",
      ui.currentFrame(),
      () => {
        path.remove(), sendEvent("updateFrame", { frame: ui.currentFrame() });
      },
      () => {
        parent.appendChild(path);
        sendEvent("updateFrame", { frame: ui.currentFrame() });
      }
    );
    sendEvent("updateFrame", { frame: ui.currentFrame() });
  }

  cancel() {
    if (this.currentPath) {
      this.currentPath.remove();
    }
    this.currentPath = null;
    currentMatrix = null;
  }
}

class Move {
  constructor() {
    this.name = "move";
    this.dragging = false;
    this.px = 0;
    this.py = 0;
  }

  select() {
    $("svg").style.cursor = "url(img/arrows.svg) 16 16, auto";
  }

  start(evt) {
    saveMatrix();
    let { x, y, wx, wy, err } = getXY(evt);
    if (err) {
      return;
    }
    this.px = x;
    this.py = y;
    this.dragging = true;
    this.origTransform = ui.currentFrame().getAttribute("transform") || "";
    document.body.classList.add("nocontextmenu");
  }

  move(evt) {
    if (!this.dragging) {
      return;
    }
    let { x, y, wx, wy, err } = getXY(evt);
    if (err) {
      return;
    }
    let dx = x - this.px;
    let dy = y - this.py;
    ui.currentFrame().setAttribute(
      "transform",
      `${this.origTransform} translate(${dx} ${dy})`
    );
  }

  stop(evt) {
    if (!this.dragging) {
      return;
    }
    this.px = 9;
    this.py = 0;
    this.dragging = false;
    let oldTransform = this.origTransform;
    this.origTransform = "";
    currentMatrix = null;
    let curr = ui.currentFrame();
    let newTransform = curr.getAttribute("transform");
    document.body.classList.remove("nocontextmenu");
    undo.pushUndo(
      "Move",
      curr,
      () => {
        curr.setAttribute("transform", oldTransform);
        sendEvent("updateFrame", { frame: ui.currentFrame() });
      },
      () => {
        curr.setAttribute("transform", newTransform);
        sendEvent("updateFrame", { frame: ui.currentFrame() });
      }
    );
    sendEvent("updateFrame", { frame: ui.currentFrame() });
  }

  cancel() {
    ui.currentFrame().setAttribute("transform", this.origTransform);
    this.dragging = false;
    this.origTransform = false;
    currentMatrix = null;
  }
}

function dist(dx, dy) {
  return Math.sqrt(dx * dx + dy * dy);
}

class Rotate {
  constructor() {
    this.name = "rotate";
    this.dragging = false;
    this.px = 0;
    this.py = 0;
    this.originalAngle = null;
  }

  select() {
    $("svg").style.cursor = "url(img/sync-alt.svg) 16 16, auto";
  }

  createOverlay() {
    this.overlay = dom.html("canvas", {
      width: innerWidth,
      height: innerHeight,
      style:
        "position:absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none;",
    });
    this.ctx = this.overlay.getContext("2d");
    document.body.appendChild(this.overlay);
  }

  drawRotationAnchor() {
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    let off = this.offset * 0.05;
    this.ctx.arc(this.anchorX, this.anchorY, 4, 0 + off, 1.75 * Math.PI + off);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.arc(
      this.anchorX,
      this.anchorY,
      8,
      0.25 * Math.PI - off,
      2 * Math.PI - off
    );
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.arc(
      this.anchorX,
      this.anchorY,
      12,
      0.5 * Math.PI + off,
      2.25 * Math.PI + off
    );
    this.ctx.stroke();
  }

  removeOverlay() {
    clearTimeout(this.timer);
    this.timer = null;
    this.overlay.remove();
    this.overlay = null;
    this.ctx = null;
  }

  drawAnts() {
    this.ctx.save();
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([4, 2]);
    this.ctx.lineDashOffset = -(this.offset % 8);
    this.ctx.beginPath();
    this.ctx.moveTo(this.anchorX, this.anchorY);
    this.ctx.lineTo(this.mouseX, this.mouseY);
    this.ctx.stroke();
    this.ctx.restore();
  }

  march() {
    if (!this.ctx) {
      this.createOverlay();
    }
    this.offset++;
    if (this.ctx) {
      this.ctx.clearRect(0, 0, innerWidth, innerHeight);
      this.drawAnts();
      this.drawRotationAnchor();
      this.timer = setTimeout(() => this.march(), 20);
    }
  }

  start(evt) {
    saveMatrix();
    let { x, y, wx, wy, err } = getXY(evt);
    if (err) {
      return;
    }
    this.anchorX = wx;
    this.anchorY = wy;
    this.px = x;
    this.py = y;
    this.dragging = true;
    this.offset = 0;
    this.march();
    this.origTransform = ui.currentFrame().getAttribute("transform") || "";
    document.body.classList.add("nocontextmenu");
  }

  move(evt) {
    if (!this.dragging) {
      return;
    }
    let { x, y, wx, wy, err } = getXY(evt);
    if (err) {
      return;
    }
    let px = this.px;
    let py = this.py;
    this.mouseX = wx;
    this.mouseY = wy;
    let dx = x - px;
    let dy = y - py;
    if (dist(dx, dy) < 20) {
      return;
    } // don't pick starting angle until we've moved a little from the starting point
    if (this.originalAngle !== null) {
      let transform = this.origTransform;
      let angle = degrees(Math.atan2(dy, dx)) - this.originalAngle;
      ui.currentFrame().setAttribute(
        "transform",
        `${transform} rotate(${angle} ${px} ${py})`
      );
    } else {
      this.originalAngle = degrees(Math.atan2(dy, dx));
    }
  }

  stop(evt) {
    if (!this.dragging) {
      return;
    }
    this.px = 9;
    this.py = 0;
    this.dragging = false;
    let oldTransform = this.origTransform;
    this.origTransform = "";
    this.originalAngle = null;
    currentMatrix = null;
    let curr = ui.currentFrame();
    let newTransform = curr.getAttribute("transform");
    document.body.classList.remove("nocontextmenu");
    this.removeOverlay();
    undo.pushUndo(
      "Rotate",
      curr,
      () => {
        curr.setAttribute("transform", oldTransform);
        sendEvent("updateFrame", { frame: ui.currentFrame() });
      },
      () => {
        curr.setAttribute("transform", newTransform);
        sendEvent("updateFrame", { frame: ui.currentFrame() });
      }
    );
    sendEvent("updateFrame", { frame: ui.currentFrame() });
  }

  cancel(evt) {
    ui.currentFrame().setAttribute("transform", this.origTransform);
    this.removeOverlay();
    this.dragging = false;
    this.origTransform = false;
    currentMatrix = null;
  }
}

class ZoomIn {
  constructor() {
    this.name = "zoomin";
  }

  select() {
    $("svg").style.cursor = "url(img/expand-arrows-alt.svg) 16 16,auto";
  }

  start(evt) {
    if (this.dragging) {
      return false;
    }
    saveMatrix();
    let { x, y, wx, wy, err } = getXY(evt);
    if (err) {
      return;
    }
    this.px = x;
    this.py = y;
    this.wx = wx;
    this.wy = wy;
    this.dragging = true;
    this.curr = ui.currentFrame();
    this.oldTransform = this.curr.getAttribute("transform") || "";
    this.drawAnchor();
  }

  move(evt) {
    if (!this.dragging) {
      return;
    }
    let { x, y, wx, wy, err } = getXY(evt);
    if (err) {
      return;
    }
    let d = dist(wx - this.wx, wy - this.wy);
    let zoomin = 1 + d / ZOOM_FACTOR;
    let newTransform = `${this.oldTransform} translate(${this.px} ${this.py}) scale(${zoomin}) translate(-${this.px}, -${this.py})`;
    this.curr.setAttribute("transform", newTransform);
  }

  stop(evt) {
    if (!this.dragging) {
      return;
    }
    currentMatrix = null;
    this.dragging = false;
    undo.pushUndo(
      "Zoom In",
      this.curr,
      () => {
        this.curr.setAttribute("transform", oldTransform);
        sendEvent("updateFrame", { frame: this.curr });
      },
      () => {
        this.curr.setAttribute("transform", newTransform);
        sendEvent("updateFrame", { frame: this.curr });
      }
    );
    this.removeOverlay();
    sendEvent("updateFrame", { frame: this.curr });
  }

  cancel(evt) {
    if (!this.dragging) {
      return;
    }
    this.dragging = false;
    currentMatrix = null;
    this.removeOverlay();
    this.curr.setAttribute("transform", this.oldTransform);
  }

  drawArrow(index) {
    const angle = (index * Math.PI) / 6;
    let length = 8 + Math.sin((this.offset * Math.PI) / 25) * 4;
    this.ctx.save();
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(this.wx, this.wy);
    this.ctx.lineTo(
      this.wx + Math.cos(angle) * length,
      this.wy + Math.sin(angle) * length
    );
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawAnchor() {
    if (!this.ctx) {
      this.createOverlay();
    }
    this.offset++;
    if (this.ctx) {
      this.ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (let angle = 0; angle < 12; angle++) {
        this.drawArrow(angle);
      }
      this.timer = setTimeout(() => this.drawAnchor(), 20);
    }
  }

  createOverlay() {
    this.overlay = dom.html("canvas", {
      width: innerWidth,
      height: innerHeight,
      style:
        "position:absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none;",
    });
    this.ctx = this.overlay.getContext("2d");
    this.offset = 0;
    document.body.appendChild(this.overlay);
  }

  removeOverlay() {
    clearTimeout(this.timer);
    this.timer = null;
    this.overlay.remove();
    this.overlay = null;
    this.ctx = null;
  }
}

class ZoomOut {
  constructor() {
    this.name = "zoomout";
  }

  select() {
    $("svg").style.cursor = "url(img/compress-arrows-alt.svg) 16 16, auto";
  }

  start(evt) {
    if (this.dragging) {
      return false;
    }
    saveMatrix();
    let { x, y, wx, wy, err } = getXY(evt);
    if (err) {
      return;
    }
    this.px = x;
    this.py = y;
    this.wx = wx;
    this.wy = wy;
    this.dragging = true;
    this.curr = ui.currentFrame();
    this.oldTransform = this.curr.getAttribute("transform") || "";
    this.drawAnchor();
  }

  move(evt) {
    if (!this.dragging) {
      return;
    }
    let { x, y, wx, wy, err } = getXY(evt);
    if (err) {
      return;
    }
    let d = dist(wx - this.wx, wy - this.wy);
    let zoomin = 1 / (1 + d / ZOOM_FACTOR);
    let newTransform = `${this.oldTransform} translate(${this.px} ${this.py}) scale(${zoomin}) translate(-${this.px}, -${this.py})`;
    this.curr.setAttribute("transform", newTransform);
  }

  stop(evt) {
    if (!this.dragging) {
      return;
    }
    currentMatrix = null;
    this.dragging = false;
    undo.pushUndo(
      "Zoom Out",
      this.curr,
      () => {
        this.curr.setAttribute("transform", oldTransform);
        sendEvent("updateFrame", { frame: this.curr });
      },
      () => {
        this.curr.setAttribute("transform", newTransform);
        sendEvent("updateFrame", { frame: this.curr });
      }
    );
    this.removeOverlay();
    sendEvent("updateFrame", { frame: this.curr });
  }

  cancel(evt) {
    if (!this.dragging) {
      return;
    }
    this.dragging = false;
    currentMatrix = null;
    this.removeOverlay();
    this.curr.setAttribute("transform", this.oldTransform);
  }
  drawArrow(index) {
    const angle = (index * Math.PI) / 6;
    let length = 8 + Math.sin((this.offset * Math.PI) / 25) * 4;
    this.ctx.save();
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(this.wx, this.wy);
    this.ctx.lineTo(
      this.wx + Math.cos(angle) * length,
      this.wy + Math.sin(angle) * length
    );
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawAnchor() {
    if (!this.ctx) {
      this.createOverlay();
    }
    this.offset++;
    if (this.ctx) {
      this.ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (let angle = 0; angle < 12; angle++) {
        this.drawArrow(angle);
      }
      this.timer = setTimeout(() => this.drawAnchor(), 20);
    }
  }

  createOverlay() {
    this.overlay = dom.html("canvas", {
      width: innerWidth,
      height: innerHeight,
      style:
        "position:absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none;",
    });
    this.ctx = this.overlay.getContext("2d");
    this.offset = 0;
    document.body.appendChild(this.overlay);
  }

  removeOverlay() {
    clearTimeout(this.timer);
    this.timer = null;
    this.overlay.remove();
    this.overlay = null;
    this.ctx = null;
  }
}

class Eraser {
  constructor() {
    this.name = "eraser";
    this.cursor = "url(img/eraser.svg) 16 28, auto";
  }

  setCursor(url, isCurrent) {
    this.cursor = url;
    if (isCurrent) {
      $("svg").style.cursor = `${url} 16 16, auto`;
    }
  }

  select() {
    $("svg").style.cursor = this.cursor;
  }

  start(evt) {
    saveMatrix();
    this.before = ui.currentFrame().innerHTML;
    let { x, y, wx, wy, err } = getXY(evt);
    if (err) {
      console.error("Houston, we have a problem");
      return;
    }
    this.prevPoint = { x, y };
    this.dragging = true;
    if (inBounds(wx, wy)) {
      erasePaths({ x, y });
    }
    document.body.classList.add("nocontextmenu");
  }

  move(evt) {
    if (!this.dragging) {
      return;
    }
    let { x, y, wx, wy, err } = getXY(evt);
    if (err) {
      return;
    }
    if (collideCircle({ x, y }, 1, this.prevPoint, 1)) {
      // too close to previous point to bother erasing
      return;
    }
    this.prevPoint = { x, y };
    if (inBounds(wx, wy)) {
      erasePaths({ x, y });
    }
  }

  stop(evt) {
    if (!this.dragging) {
      return;
    }
    this.dragging = false;
    this.prevPoint = null;
    let before = this.before;
    let curr = ui.currentFrame();
    let after = curr.innerHTML;
    document.body.classList.add("nocontextmenu");
    undo.pushUndo(
      "Erase",
      curr,
      () => {
        curr.innerHTML = before;
        sendEvent("updateFrame", { frame: ui.currentFrame() });
      },
      () => {
        curr.innerHTML = after;
        sendEvent("updateFrame", { frame: ui.currentFrame() });
      }
    );
    this.before = null;
    sendEvent("updateFrame", { frame: ui.currentFrame() });
  }

  cancel() {
    this.dragging = false;
    this.prevPoint = null;
  }
}

// UTILITIES

function pointFromText(t) {
  // expects t to be in the form of M124,345 or L23,345, i.e. an absolute move or lineTo followed by x,y coordinates
  let cmd = t[0];
  let [x, y] = t.slice(1).split(",").map(Number);
  return { cmd, x, y };
}

function pointsFromPath(path) {
  return path
    .getAttribute("d")
    .replace(/, /g, ",")
    .split(/[ ]+/)
    .map(pointFromText);
}

function pointsToPath(points) {
  if (!points.length) {
    return null;
  }
  return points.map(pt => `${pt.cmd}${pt.x},${pt.y}`).join(" ");
}

// Because points are actually circles (due to penWidth / eraserWidth) this is a basic circle collision algorithm
function collideCircle(p1, r1, p2, r2) {
  return (
    Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) < Math.pow(r1 + r2, 2)
  );
}

function collideBox(r1, r2) {
  if (r1.x + r1.width < r2.x) {
    return false;
  }
  if (r1.y + r1.height < r2.y) {
    return false;
  }
  if (r1.x > r2.x + r2.width) {
    return false;
  }
  if (r1.y > r2.y + r2.height) {
    return false;
  }
  return true;
}

function inBounds(x, y) {
  return !(x < 0 || x > WIDTH || y < 0 || y > HEIGHT);
}

function saveMatrix() {
  let matrix = ui.currentFrame().getCTM();
  if (matrix instanceof SVGMatrix) {
    matrix = new DOMMatrix([
      matrix.a,
      matrix.b,
      matrix.c,
      matrix.d,
      matrix.e,
      matrix.f,
    ]);
  }
  currentMatrix = matrix.inverse();
}

function getXY(evt) {
  if (evt.button) {
    // left button is 0, for touch events button will be undefined
    return { x: 0, y: 0, err: true };
  }
  if (evt.touches && evt.touches.length > 1) {
    // don't interfere with multi-touch
    return { x: 0, y: 0, err: true };
  }
  if (evt.cancelable) {
    evt.preventDefault();
  }

  const rect = ui.doc.getBoundingClientRect();
  const position = (evt.changedTouches && evt.changedTouches[0]) || evt;
  let x = position.offsetX;
  let y = position.offsetY;

  if (typeof x === "undefined") {
    x = position.clientX - rect.left;
  }
  if (typeof y === "undefined") {
    y = position.clientY - rect.top;
  }
  // if the frame has been translated, rotated, or scaled, we need to map the point to the current matrix
  let { x: tx, y: ty } = transformPoint(x, y);
  return { x: tx, y: ty, wx: x, wy: y, err: false };
}

function transformPoint(x, y) {
  let frame = ui.currentFrame();
  if (frame.transform.baseVal.length === 0) {
    return { x, y };
  }
  return currentMatrix.transformPoint(new DOMPoint(x, y));
}

function drawBoundingBox(bbox, color) {
  let r = dom.svg("rect", {
    x: bbox.x,
    y: bbox.y,
    width: bbox.width,
    height: bbox.height,
    fill: "none",
    stroke: color || "#00F",
  });
  ui.currentFrame().appendChild(r);
}

function erasePaths(point) {
  let candidatePaths = $$(ui.currentFrame(), "path");
  let paths = collidePaths(point, candidatePaths);
  paths.forEach(path => erasePath(point, path));
}

function erasePath(pt1, path) {
  let r1 = state.eraserWidth;
  let r2 = Number(path.getAttribute("stroke-width"));
  let deletions = false;
  // instead of filtering, make two passes:
  // First pass, delete any points which collide and make the point which follows (if any) a Move cmd
  let points = pointsFromPath(path);
  for (let i = points.length - 1; i > -1; i--) {
    let pt2 = points[i];
    if (collideCircle(pt1, r1, pt2, r2)) {
      deletions = true;
      points.splice(i, 1); // remove the current element
      if (points[i]) {
        points[i].cmd = "M"; // change the following element to be a move, if it exists
      }
    }
  }
  if (!deletions) {
    return; // Nothing changed, we're done here
  }
  // Second pass, delete any move commands that precede other move commands
  for (let i = 0; i < points.length; i++) {
    let p = points[i];
    if (p.cmd === "M") {
      if (!points[i + 1] || points[i + 1].cmd === "M") {
        points.splice(i, 1); // Don't need two moves in a row, or a trailing move
      }
    }
  }
  // Finally, if there is only a single move and no other points, delete the whole path
  if (!points.length) {
    path.remove();
  } else {
    path.setAttribute("d", pointsToPath(points));
  }
}

function collidePaths(point, paths) {
  // quck check to try to eliminate paths that don't intersect
  let d = state.eraserWidth / 2;
  let eraserBox = {
    x: point.x - d,
    y: point.y - d,
    width: state.eraserWidth,
    height: state.eraserWidth,
  };
  // drawBoundingBox(eraserBox, '#F00');
  return paths.filter(path =>
    collideBox(eraserBox, path.getBBox({ stroke: true }))
  );
}

document.body.addEventListener("contextmenu", evt => {
  if (document.body.classList.contains("nocontextmenu")) {
    evt.preventDefault();
    return false;
  }
});

export { Pen, Move, Rotate, ZoomIn, ZoomOut, Eraser, radians, degrees };
