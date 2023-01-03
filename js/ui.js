/* Functions specifically to manipulate the DOM go here */

import * as dom from "/jitter/js/dom.js";
const { $, $$, html } = dom;
import state from "/jitter/js/state.js";

// polyfill for dialog
const dialog = $$("dialog").forEach(dialog =>
  dialogPolyfill.registerDialog(dialog)
);

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

  static frameToImage(frame, targetHeight) {
    console.log("frame: %o", frame);
    let img = frame.querySelector("image");
    if (!img) {
      return null;
    }
    let targetWidth;
    if (targetHeight) {
      targetWidth = Math.floor(img.width / (img.height / targetHeight));
      console.log("target width: %s", targetWidth);
    } else {
      targetHeight = img.height;
      targetWidth = img.width;
    }
    let c = html("canvas", {
      class: "canvas-frame ginger",
      id: frame.id + "-canvas",
      width: targetWidth,
      height: targetHeight,
    });
    let ctx = c.getContext("2d");
    img
      .decode()
      .then(() =>
        ctx.drawImage(
          img,
          0,
          0,
          img.width,
          img.height,
          0,
          0,
          targetWidth,
          targetHeight
        )
      );
    return img;
  }

  static animationToImages() {
    return $$(".frame").map(frame => ui.frameToImage(frame));
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
    window.WIDTH = 640;
    window.HEIGHT = 480;
    ui.doc.setAttribute("width", 640);
    ui.doc.setAttribute("height", 480);
  }

  // Render state as needed
  static set name(val) {
    $("#filename").value = val;
    document.title = "Jitter: " + val;
  }

  static set doonionskin(val) {
    $("#doonionskin").checked = val;
    if (val) {
      dom.addClass(dom.previous(ui.currentFrame(), ".frame"), "onionskin");
    } else {
      $$(".frame.onionskin").forEach(frame =>
        frame.classList.remove("onionskin")
      );
    }
  }

  static set showvideo(val) {
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

  static set fileTab(flag) {
    if (flag) {
      $("#file-toolbar").classList.add("active");
    } else {
      $("#file-toolbar").classList.remove("active");
    }
  }

  static set framesTab(flag) {
    if (flag) {
      $("#frames-toolbar").classList.add("active");
    } else {
      $("#frames-toolbar").classList.remove("active");
    }
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
}

if (!ui.doc) {
  console.log("initialize svg");
  ui.doc = dom.svg("svg");
  ui.doc.id = "doc";
  document.body.prepend(ui.doc);
}

export default ui;
