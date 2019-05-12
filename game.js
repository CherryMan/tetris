'use strict';

const PIECES = {
  I: { clr: '#c1f2f9', blk: [[-1,+0], [+0,+0], [+1,+0], [+2,+0]] },
  O: { clr: '#e4fbb3', blk: [[+0,+0], [-1,+0], [-1,+1], [+0,+1]] },
  T: { clr: '#ebbab9', blk: [[+0,+0], [-1,+0], [+0,+1], [+1,+0]] },
  J: { clr: '#75b9be', blk: [[-1,+1], [-1,+0], [+0,+0], [+1,+0]] },
  L: { clr: '#ffc09f', blk: [[-1,+0], [+0,+0], [+1,+0], [+1,+1]] },
  S: { clr: '#ceec97', blk: [[-1,+0], [+0,+0], [+0,+1], [+1,+1]] },
  Z: { clr: '#e34a6f', blk: [[-1,+1], [+0,+1], [+0,+0], [+1,+0]] },
};

class Field {
  constructor(id, [width, height], bg_clr) {
    this.cnv = document.getElementById(id);
    this.ctx = this.cnv.getContext('2d', { alpha: false });

    let field = new Array(width).fill(false)
      .map(() => new Uint8Array(height).fill(false));

    Object.defineProperties(this, {
      width:     { writable: false, value: width },
      height:    { writable: false, value: height },
      bg_clr:    { writable: false, value: bg_clr },
      blk_width: { writable: false, value: this.cnv.width/width },
      field:     { writable: false, value: field },
    });
  }

  clear() {
    this.field.map((x) => x.fill(false));

    this.ctx.fillStyle = this.bg_clr;
    this.ctx.fillRect(0, 0, this.cnv.width, this.cnv.height);
  }

  _write_blk([x, y], val, clr) {
    this.field[x][y] = val;
    this.ctx.fillStyle = clr;
    this.ctx.fillRect(x*this.blk_width, y*this.blk_width,
                      this.blk_width, this.blk_width);
  }

  fill_blk(pos, name) {
    this._write_blk(pos, name.codePointAt(0), PIECES[name].clr);
  }

  clear_blk(pos){
    this._write_blk(pos, false, this.bg_clr);
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function pick_elem(xs) {
  return xs[Math.floor(xs.length * Math.random())];
}

function rotr(b) {
  return b.map(([x, y]) => [-y, x]);
}

async function main(id) {
  let field = new Field(id, [10, 20], '#eeeeee');
  field.clear();

  const piece_names = Object.keys(PIECES);

  let piece_name;
  let piece;
  let b;    // current piece
  let x, y; // coordinates

  let fill = (f) => {
    for (const [w, h] of b) f([x+w, y+h]);
  };

  let move = (f) => {
    fill((pos) => field.clear_blk(pos));
    f(); // apply given transformation
    fill((pos) => field.fill_blk(pos, piece_name));
  }

  let translate = (dx, dy) =>
    move(() => {x += dx, y += dy});

  let rotate = () =>
    move(() => {b = rotr(b)});

  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowLeft'  : translate(-1, +0); break;
      case 'ArrowRight' : translate(+1, +0); break;
      case 'ArrowDown'  : translate(+0, +1); break;
      case 'ArrowUp'    : rotate();          break;
    }
  });

  while (true) {
    piece_name = pick_elem(piece_names);
    piece      = PIECES[piece_name];

    [x,y] = [4,0];
    b     = piece.blk;
    translate(0, 0); // draw piece
    while (y < field.height) {
      await sleep(1000);
      translate(0, 1);
    }
    field.clear(0);
  }
}
