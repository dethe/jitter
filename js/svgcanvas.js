import * as dom from "/jitter/js/dom.js";
import { radians } from "/jitter/js/tool.js";

class SVGCanvas {
  constructor(frame, x, y, width, height, maxHeight) {
    this.scaleFactor = 1;
    if (maxHeight) {
      this.scaleFactor = maxHeight / height;
      width = width * this.scaleFactor;
      height = maxHeight;
    }
    this.canvas = dom.html("canvas", {
      width: width,
      height: height,
      class: "canvas-frame",
      id: frame.id + "-canvas",
    });
    this.ctx = this.canvas.getContext("2d");
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.svg = frame;
    this.offset = { x, y };
    this.draw();
  }

  draw() {
    this.setTransforms();
    let lines = this.svg.querySelectorAll("path");
    lines.forEach(line => this.drawLine(line));
    let images = this.svg.querySelectorAll("image");
    images.forEach(img => this.ctx.drawImage(img, 0, 0));
  }

  setTransforms() {
    this.scale(this.scaleFactor); // handle non 1:1 conversion
    this.translate(-this.offset.x, -this.offset.y);
    let transforms = this.svg.transform.baseVal;
    for (let idx = 0; idx < transforms.numberOfItems; idx++) {
      let tx = transforms.getItem(idx);
      switch (tx.type) {
        case 2: // SVG_TRANSFORM_TRANSLATE
          this.translate(tx.matrix.e, tx.matrix.f);
          break;
        case 3: // SVG_TRANSFORM_SCALE
          this.scale(tx.matrix.a); // y-scale is tx.matrix.d, but we don't support non-uniform scaling
          break;
        case 4: // SVG_TRANSFORM_ROTATE
          // this.rotate(tx.angle, tx.matrix.e, tx.matrix.f);
          this.applyMatrix(tx.matrix);
          break;
        default:
          throw new Exception("Unsupported transform: %o", tx);
          break;
      }
    }
    // let { a, b, c, d, e, f } = this.svg.getCTM();
    // this.ctx.setTransform(a, b, c, d, e - this.offset.x, f - this.offset.y);
  }

  translate(x, y) {
    this.ctx.translate(x, y);
  }

  scale(x) {
    this.ctx.scale(x, x);
  }

  rotate(angle, cx, cy) {
    this.ctx.translate(cx, cy);
    this.ctx.rotate(radians(angle));
    this.ctx.translate(-cx, -cy);
  }

  applyMatrix(m) {
    this.ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
  }

  drawLine(line) {
    this.ctx.beginPath();
    this.ctx.lineWidth = Number(line.getAttribute("stroke-width"));
    this.ctx.strokeStyle = line.getAttribute("stroke");
    let path = line
      .getAttribute("d")
      .slice(1)
      .trim()
      .split(/\s*L\s*/);
    let pairs = path.map(p => p.split(/\s*,\s*/).map(Number));
    let start = pairs.shift();
    this.ctx.moveTo(...start);
    pairs.forEach(p => {
      this.ctx.lineTo(...p);
    });
    this.ctx.stroke();
  }
}

export default SVGCanvas;
