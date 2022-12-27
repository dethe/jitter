// Mess: toast-style dialog popups
// Source: https://github.com/graciano/mess
// Author: Matheus Graciano (pc-beta) <graciano.dev@gmail.com>
// showHtml() added, modularization, changes to style by Dethe Elza
// license: MIT

function Mess() {
  // FIXME: Support multiple notifications
  this.messElem = document.createElement("span");
  this.messElem.id = "mess-messElement";
  document.body.appendChild(this.messElem);
}

Mess.prototype.fadeOut = function () {
  this.messElem.classList.remove("shown");
  this.timer = null;
};

Mess.prototype.fadeIn = function (display) {
  if (this.timer){
    clearTimeout(this.timer);
  }
  this.messElem.classList.add("shown");
  this.timer = setTimeout(()=>this.fadeOut(), 5000);
};

Mess.prototype.show = function (string) {
  this.message = string;
  this.messElem.textContent = string;
  this.fadeIn();
};

Mess.prototype.showHtml = function (string, onclick) {
  this.messElem.innerHTML = string;
  this.message = this.messElem.textContent;
  let button = this.messElem.querySelector("button");
  if (button && onclick) {
    button.onclick = onclick;
  }
  this.fadeIn();
};

export default Mess;
