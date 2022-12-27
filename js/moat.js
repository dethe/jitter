// File support for use with Moat filesharing
// See moat server: https://glitch.com/~sd-moat

import timeago from "/jitter/lib/timeago.js";
import QrCreator from "/jitter/lib/qr-creator.js";
import { saveToCallback } from "/jitter/js/file.js";
import * as dom from "/jitter/js/dom.js";
const { $, $$ } = dom;

// CONFIGURATION
let params = new URLSearchParams(new URL(window.location).search);
const USE_MOAT = params.has("moat") || ("" + location).includes("launchpad");

const MOAT_URL = window.location.host.includes("glitch")
  ? "https://sd-moat.glitch.me/"
  : "https://launchpad.yourlibrary.ca/moat/";

function sendToMoat(data, filename, progid) {
  saveToCallback(data, filename, (blob, filename) =>
    sendToMoatCB(blob, filename, progid)
  );
}

function sendToMoatCB(blob, filename, progid) {
  try{
    let formData = new FormData();
    formData.append("program", progid);
    formData.append("file", blob, filename);
    let request = new XMLHttpRequest();
    request.open("POST", MOAT_URL + "file/create");
    request.setRequestHeader("X-Requested-With", "XMLHTTPRequest");
    request.send(formData);
    request.onload = () => showFilePage(request.response);
    request.onerror = () => handleError("send file");
    request.ontimeout = () => handleTimeout("send file");
  }catch(e){
    alert('something went wrong: %s', e.message);
  }
}

function handleError(step) {
  alert("Error uploading to Moat during " + step + " step, please try again.");
}

function handleTimeout(step) {
  alert("Timeout uploading to Moat during " + step + ", please try again.");
}

function showQRCode(url) {
  let qrElement = $("#qrcode");
  if (qrElement) {
    QrCreator.render(
      {
        text: url,
        ecLevel: "H",
        fill: "#000000",
        background: "#FFFFFF", // null for transparent
        size: 128,
      },
      qrElement
    );
  }
}

function updateExpires() {
  let expires = document.querySelectorAll(".expires");
  if (expires.length) {
    expires.forEach(
      e => (e.innerText = timeago.format(e.getAttribute("timestamp")))
    );
    setTimeout(updateExpires, 1000);
  }
}

function updateDialog(url) {
  showQRCode(url);
  updateExpires();
}

const dialog = $("#moat-dialog");

function showFilePage(res) {
  dialog.firstElementChild.innerHTML = res;
  let url = dialog.firstElementChild.querySelector("a").href;
  updateDialog(url);
  dialog.showModal();
}

function setMoatUI(list) {
  let moat = $("#moat");
  if (list.length) {
    if (list.length > 1) {
      moat.append(dom.html("option", { value: "" }, "Choose a Program"));
    }
    list.forEach(item =>
      moat.append(dom.html("option", { value: item.id }, item.name))
    );
  } else {
    moat.appendChild(
      dom.html("option", { value: "" }, "No Moat Programs Found")
    );
    moat.disabled = true;
    $("#save-moat").disabled = true;
  }
}

function clearMoatUI() {
  $("#moat-container").remove();
}

function queryMoat(cb) {
  fetch(MOAT_URL + "programs/?integration=shimmy").then(response =>
    response.json().then(cb)
  );
}
if (USE_MOAT) {
  dom.listen(window, "load", e => queryMoat(setMoatUI));
} else {
  $("#moat-container").remove();
}

export { sendToMoat };
