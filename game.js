'use strict';

const PIECES = {
  I: { clr: '#c1f2f9', blk: [[-1,+0], [+0,+0], [+1,+0], [+2,+0]] },
  O: { clr: '#e4fbb3', blk: [[+0,+0], [+1,+0], [+1,+1], [+0,+1]] },
  T: { clr: '#ebbab9', blk: [[+0,+0], [-1,+0], [+0,+1], [+1,+0]] },
  J: { clr: '#75b9be', blk: [[-1,+1], [-1,+0], [+0,+0], [+1,+0]] },
  L: { clr: '#ffc09f', blk: [[-1,+0], [+0,+0], [+1,+0], [+1,+1]] },
  S: { clr: '#ceec97', blk: [[-1,+0], [+0,+0], [+0,+1], [+1,+1]] },
  Z: { clr: '#e34a6f', blk: [[-1,+1], [+0,+1], [+0,+0], [+1,+0]] },
};

const PIECE_NAMES = Object.keys(PIECES);

function offset_tbl(piece_name, state) {
  switch (piece_name) {
    case 'T':
    case 'J':
    case 'L':
    case 'S':
    case 'Z':
      return [
        [[+0,+0], [+0,+0], [+0,+0], [+0,+0], [+0,+0]],
        [[+0,+0], [+1,+0], [+1,-1], [+0,+2], [+1,+2]],
        [[+0,+0], [+0,+0], [+0,+0], [+0,+0], [+0,+0]],
        [[+0,+0], [-1,+0], [-1,-1], [+0,+2], [-1,+2]],
      ][state];
      break;
    case 'I':
      return [
        [[+0,+0], [-1,+0], [+2,+0], [-1,+0], [+2,+0]],
        [[-1,+0], [+0,+0], [+0,+0], [+0,+1], [+0,-2]],
        [[-1,+1], [+1,+1], [-2,+1], [+1,+0], [-2,+0]],
        [[+0,+1], [+0,+1], [+0,+1], [+0,-1], [+0,+2]],
      ][state];
      break;
    case 'O':
      return [
        [[+0,+0]],
        [[+0,-1]],
        [[-1,-1]],
        [[-1,+0]],
      ][state];
      break;
  }
}

function get_offsets(piece_name, prev_st, next_st) {
  let r = []; // return val
  const ps = offset_tbl(piece_name, prev_st);
  const ns = offset_tbl(piece_name, next_st);

  for (let i = 0; i < ns.length; ++i) {
    let [px, py] = ps[i];
    let [nx, ny] = ns[i];

    r[i] = [px - nx, py - ny];
  }

  return r;
}

class Field {
  constructor(id, [width, height], bg_clr) {
    this.cnv = document.getElementById(id);
    this.ctx = this.cnv.getContext('2d', { alpha: false });

    this.field = new Array(width).fill(0)
      .map(() => new Uint8Array(height).fill(0));

    Object.defineProperties(this, {
      width:     { writable: false, value: width },
      height:    { writable: false, value: height },
      bg_clr:    { writable: false, value: bg_clr },
      blk_width: { writable: false, value: this.cnv.width/width },
    });
  }

  clear() {
    this.field = this.field.map((x) => x.fill(0));

    this.ctx.fillStyle = this.bg_clr;
    this.ctx.fillRect(0, 0, this.cnv.width, this.cnv.height);
  }

  coord_free([x, y]) {
    return x >= 0 && x < this.width
        && y >= 0 && y < this.height
        && this.field[x][y] === 0;
  }

  coords_free(cs) {
    return cs.every(p => this.coord_free(p));
  }

  coord_to_px([x, y]) {
    return [
      this.blk_width * x,
      this.blk_width * (this.height - (y+1)),
    ];
  }

  coords_fill(coords, clr) {
    this.ctx.fillStyle = clr;
    for (let [x, y] of coords.map(c => this.coord_to_px(c)))
      this.ctx.fillRect(
        x, y,
        this.blk_width, this.blk_width
      );
  }

  coords_unfill(cs) { this.coords_fill(cs, this.bg_clr); }

  coords_set(cs, name) {
    name = name !== 0 && Number.isInteger(name)
      ? String.fromCharCode(name) : name

    let clr =
      name === 0 ? this.bg_clr : PIECES[name].clr;

    this.coords_fill(cs, clr);

    for (const [x, y] of cs)
      this.field[x][y] = name && name.charCodeAt(0);
  }

  coords_unset(cs) { this.coords_set(cs, 0); }
}

class Piece {
  constructor(blk, [x, y], state = 0) {
    const coords =
      blk.map(([dx, dy]) => [x + dx, y + dy]);

    Object.defineProperties(this, {
      blk:    { writable: false, value: blk    },
      x:      { writable: false, value: x      },
      y:      { writable: false, value: y      },
      st:     { writable: false, value: state  },
      coords: { writable: false, value: coords },
    });
  }

  static rotr(p) {
    return new Piece(
      p.blk.map(([x, y]) => [y, -x]),
      [p.x, p.y],
      p.st < 3 ? p.st+1 : 0
    )
  }

  static rotl(p) {
    return new Piece(
      p.blk.map(([x, y]) => [-y, x]),
      [p.x, p.y],
      p.st > 0 ? p.st-1 : 3
    )
  }

  static trans(p, [dx, dy]) {
    return new Piece(
      p.blk,
      [p.x + dx, p.y + dy],
      p.st
    );
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function pick_elem(xs) {
  return xs[Math.floor(xs.length * Math.random())];
}

class State {
  constructor(id, dims, bg) {
    this.clr     = null; // colour
    this.name    = null; // piece name
    this.p       = null; // piece
    this.onLoss  = () => {};
    this.field   = new Field(id, dims, bg);
  }

  rst() {
    this.field.clear();
    this.new_pc()
  }

  tick() {
    const n = Piece.trans(this.p, [0, -1]).coords;
    if (this.field.coords_free(n)) {
      this.trans([0, -1]);
      return;
    }
    this.set_pc()
    this.new_pc()
  }

  new_pc() {
    this.name = pick_elem(PIECE_NAMES);
    this.clr  = PIECES[this.name].clr;
    this.p    = new Piece(PIECES[this.name].blk, [4, this.field.height - 2]);

    if (!this.field.coords_free(this.p.coords)) {
      this.onLoss()
      return;
    }

    this.field.coords_fill(this.p.coords, this.clr);
  }

  set_pc() {
    this.field.coords_set(this.p.coords, this.name);

    let cleared = this.p.coords
      .map(([_, y]) => y)
      .filter(y => {
        for (let x = 0; x < this.field.width; ++x)
          if (this.field.coord_free([x, y]))
            return false;
        return true;
      })
      .sort((a, b) => b - a); // reverse sort

    for (const y of new Set(cleared)) // uniq
      this.clear_row(y)
  }

  clear_row(y) {
    for (; y < this.field.height - 1; ++y)
      for (let x = 0; x < this.field.width; ++x)
        if (this.field.field[x][y] !== this.field.field[x][y+1])
          this.field.coords_set(
            [[x, y]],
            this.field.field[x][y+1]
          );
  }

  _mv(f) {
    this.field.coords_unfill(this.p.coords);
    this.p = f(this.p);
    this.field.coords_fill(this.p.coords, this.clr);
  }

  trans([dx, dy]) {
    this._mv((p) => {
      let np = Piece.trans(p, [dx, dy]);

      if (this.field.coords_free(np.coords))
        return np;
      else
        return p;
    });
  }

  dorot(f) {
    this._mv((p) => {
      let np = f(p)
      let offs =
        get_offsets(this.name, p.st, np.st)
        .map(off => Piece.trans(np, off));

      for (const x of offs)
        if (this.field.coords_free(x.coords))
          return x;

      return p;
    });
  }

  rotr() { this.dorot((p) => Piece.rotr(p)); }
  rotl() { this.dorot((p) => Piece.rotl(p)); }
}

async function main(id) {
  let st        = new State(id, [10, 20], '#eeeeee');
  let keyDownId = null;
  let gId       = null;
  let pause     = null;

  let start = () => { pause = null; gId = setInterval(() => st.tick(), 1000); }
  let stop  = () => { pause = true; clearInterval(gId); }

  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowUp'   :
      case 'x'         : st.rotr(); break;
      case 'z'         : st.rotl(); break;
      case 'ArrowLeft' : st.trans([-1,+0]); break;
      case 'ArrowRight': st.trans([+1,+0]); break;
      case 'ArrowDown' :
        st.trans([+0,-1])
        keyDownId =
          keyDownId || setInterval(() => st.trans([+0,-1]), 65);
        break;
      case 'p'         :
        pause ? start() : stop();
        console.log(`paused: ${!!pause}`)
        break;
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowDown') {
      clearInterval(keyDownId);
      keyDownId = null;
    }
  })

  st.rst();
  start();
  st.onLoss = () => {
    clearInterval(gId);
    console.log(":(");
  }
}
