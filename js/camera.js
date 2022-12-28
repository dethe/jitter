// camera.js

import * as dom from "/jitter/js/dom.js";

let video;

function initialize(id) {
  // id should reference the video element to attach to
  navigator.mediaDevices
    .getUserMedia({ video: true })
    .then(mediaStream => {
      video = document.querySelector("#" + id);
      video.srcObject = mediaStream;
      video.onloadedmetadata = () => {
        video.play();
      };
    })
    .catch(err => {
      // always check for errors at the end.
      console.error(`${err.name}: ${err.message}`);
    });
}

function canvasSnapshot() {
  const c = dom.html("canvas", { width: video.width, height: video.height });
  const ctx = c.getContext("2d");
  ctx.drawImage(video, 0, 0);
  return c;
}

function urlSnapshot() {
  return canvasSnapshot().toDataURL();
}

function htmlSnapshot() {
  return dom.html("img", {
    width: video.width,
    height: video.height,
    src: urlSnapshot(),
  });
}

function svgSnapshot() {
  return dom.svg("image", {
    width: video.width,
    height: video.height,
    href: urlSnapshot(),
  });
}

export { initialize, canvasSnapshot, urlSnapshot, htmlSnapshot, svgSnapshot };
