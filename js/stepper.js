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

// Intended to enhance UI without being required. Will find any <input type="number" and replace them with this control to provide better visibility and larger targets for the stepper.
// Based on the Stepper component in Form Design Patterns, by Adam Silver (starts on p. 181)

// CSS

const css_rules = `
.visually-hidden {
 border: 0!important;
 clip: rect(0 0 0 0)!important;
 height: 1px!important;
 margin: -1px!important;
 overflow: hidden!important;
 padding: 0!important;
 position: absolute!important;
 width: 1px!important
}

[type=number]{
 font-size: 1em;
 line-height: 1.25;
 font-family: inherit;
 -webkit-box-sizing: border-box;
 -moz-box-sizing: border-box;
 box-sizing: border-box;
 -webkit-appearance: none;
 appearance: none;
 border: 2px solid #222
}

@media (min-width:37.5em) {
 [type=number]{
  font-size: 1.125rem;
  line-height: 1.38889
 }
}

[type=number]:focus {
 outline: 0;
 box-shadow: 0 0 1px 4px #ffbf47
}

.stepper{
  max-width: 4rem;
  max-height: 2rem;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}

.stepper button{
 font: inherit;
 border: none;
 -webkit-appearance: none;
 appearance: none;
 font-size: 1.5rem;
 line-height: 1.17rem;
 padding: 0;
 background-color: #222;
 vertical-align: bottom;
 text-align: center;
 color: #fff;

}
@media (min-width:37.5em) {
 .stepper button{
  font-size: 1.125rem;
  line-height: 1.38889;
  max-height: 2rem;
 }
}
.stepper button:hover {
 background-color: #000
 color: #ffbf47
}
.stepper-remove-button {
 border-radius: 10px 0 0 10px;
}
.stepper-add-button {
 border-radius: 0 10px 10px 0;
}
.stepper input {
 display:inline-block;
 max-width: 2rem;
 max-height: 2rem;
 text-align: center;
 z-index: 2;
 position: relative;
 border-radius: 5;
}
.stepper input[type=number]::-webkit-inner-spin-button,
.stepper input[type=number]::-webkit-outer-spin-button {
 -webkit-appearance:none;
 margin:0;
}
.stepper input[type="number"] {
    -moz-appearance: textfield;
}
`;

function addCSS() {
  let style = document.createElement("style");
  style.innerText = css_rules;
  document.head.append(style);
}
addCSS();

function upgrade(input) {
  let id = input.id;
  let name = input.getAttribute("name") || input.id;
  let value = input.value;
  let min = input.getAttribute("min");
  let max = input.getAttribute("max");
  let step = input.getAttribute("step");
  let klass = input.getAttribute("class");

  window["increment" + id] = function() {
    let input = document.querySelector("#" + id);
    input.stepUp();
  };
  window["decrement" + id] = function() {
    let input = document.querySelector("#" + id);
    input.stepDown();
  };
  input.outerHTML = `<div class="field">
    <div class="stepper">
      <button type="button" class="stepper-remove-button" aria-label="Decrease" aria-describedby="${id}-label">&minus;</button>
      <input type="number" class="stepper-input" id="${id}" name="${name}" value="${value}">
      <button type="button" class="stepper-add-button" aria-label="Increase" aria-describedby="${id}-label">&plus;</button>
      <div id="${id}-status" class="visually-hidden" role="status" aria-live="polite">${value}</div>
     </div>
   </div>
  `;
  let newInput = document.querySelector(`#${id}`);
  if (min) {
    newInput.setAttribute("min", min);
  }
  if (max) {
    newInput.setAttribute("max", max);
  }
  if (step) {
    newInput.setAttribute("step", step);
  }
  if (klass) {
    newInput.setAttribute("class", klass);
  }
}

export {upgrade};
