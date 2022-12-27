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

/* globals QRCode */

// TODO: Separate out file-format specifics, other non-file functions

import * as dom from "/jitter/js/dom.js";
const { $, $$ } = dom;
import { sendToMoat } from "/jitter/js/moat.js"; // Conditionally handle secure sharing via Moat

function save(data, title) {
  if (!title) {
    return;
  }
  saveAs(data, `${title}.svg`);
}

const filetypes = {
  svg: "image/svg+xml",
  png: "image/png",
  gif: "image/gif",
  zip: "application/zip",
};

// Used by both file and moat
function saveToCallback(data, filename, cb) {
  // Callback is shaped cb(blob, filename);
  let ext = filename.split(".").pop();
  let filetype = filetypes[ext];
  if (data.constructor === Blob) {
    cb(data, filename);
  } else if (data.toBlob) {
    // ex: canvas.toBlob()
    data.toBlob(blob => cb(blob, filename), filetype);
  } else {
    cb(new Blob([data], { type: filetype }), filename);
  }
}

function saveAs(data, filename) {
  saveToCallback(data, filename, saveBlob);
}

function saveBlob(blob, filename) {
  var reader = new FileReader();
  reader.onloadend = function () {
    var a = dom.html("a", {
      href: reader.result,
      download: filename,
      target: "_blank",
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    dom.sendEvent("FileSaved", { filename });
  };
  reader.readAsDataURL(blob);
}

function read(file, cb) {
  var fileName = file.name;
  if (fileName.indexOf(".svg", fileName.length - 5) === -1) {
    return alert("Not an SVG file");
  }
  var reader = new FileReader();
  reader.readAsText(file);
  reader.onload = function (evt) {
    cb(evt.target.result);
  };
}

function load(cb) {
  let forSure = confirm(
    "This will overwrite your current document, be sure to save first. Delete and open another document?"
  );
  if (!forSure) {
    return;
  }

  var input = dom.html("input", { type: "file", accept: "image/svg+xml" });
  if (!input) {
    return;
  }
  dom.listen(input, "change", evt => read(input.files[0], cb));
  input.click();
}

export { load, save, saveAs, sendToMoat, saveToCallback };
