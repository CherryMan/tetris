'use strict';

const PIECES = [
/*0*/{ clr: '#eaeaea' }, // background
/*I*/{ clr: '#00bfb2', blk: [[-1,+0], [+0,+0], [+1,+0], [+2,+0]] },
/*O*/{ clr: '#f7f052', blk: [[+0,+0], [+1,+0], [+1,+1], [+0,+1]] },
/*T*/{ clr: '#6f2dbd', blk: [[+0,+0], [-1,+0], [+0,+1], [+1,+0]] },
/*J*/{ clr: '#2191fb', blk: [[-1,+1], [-1,+0], [+0,+0], [+1,+0]] },
/*L*/{ clr: '#f6511d', blk: [[-1,+0], [+0,+0], [+1,+0], [+1,+1]] },
/*S*/{ clr: '#7ac74f', blk: [[-1,+0], [+0,+0], [+0,+1], [+1,+1]] },
/*Z*/{ clr: '#e23863', blk: [[-1,+1], [+0,+1], [+0,+0], [+1,+0]] },
];

function pick_piece() {
  return Math.trunc((PIECES.length - 1) * Math.random()) + 1;
}

function offset_tbl(piece_name, state) {
  switch (piece_name) {
    case 1: // I
      return [
        [[+0,+0], [-1,+0], [+2,+0], [-1,+0], [+2,+0]],
        [[-1,+0], [+0,+0], [+0,+0], [+0,+1], [+0,-2]],
        [[-1,+1], [+1,+1], [-2,+1], [+1,+0], [-2,+0]],
        [[+0,+1], [+0,+1], [+0,+1], [+0,-1], [+0,+2]],
      ][state];
      break;
    case 2: // O
      return [
        [[+0,+0]],
        [[+0,-1]],
        [[-1,-1]],
        [[-1,+0]],
      ][state];
      break;
    default:
      return [
        [[+0,+0], [+0,+0], [+0,+0], [+0,+0], [+0,+0]],
        [[+0,+0], [+1,+0], [+1,-1], [+0,+2], [+1,+2]],
        [[+0,+0], [+0,+0], [+0,+0], [+0,+0], [+0,+0]],
        [[+0,+0], [-1,+0], [-1,-1], [+0,+2], [-1,+2]],
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
  constructor(id, [width, height]) {
    this.width  = width;
    this.height = height;
    this.cnv    = document.getElementById(id);
    this.ctx    = this.cnv.getContext('2d', { alpha: false });

    this.field = new Array(width).fill(0)
      .map(() => new Uint8Array(height).fill(0));

    this.reset_dims();
  }

  reset_dims() {
    let winRatio   = window.innerWidth / window.innerHeight;
    let fieldRatio = this.width / this.height;

    let w =
      winRatio >= fieldRatio
      ? window.innerHeight / this.height
      : window.innerWidth  / this.width

    this.blk_width  = Math.trunc(.99 * w);
    this.cnv.width  = this.blk_width * this.width;
    this.cnv.height = this.blk_width * this.height;
  }

  redraw() {
    this.field
      .forEach((a, x) =>
        a.forEach((c, y) => this.coords_fill([[x,y]], c)));
  }

  clear() {
    this.field = this.field.map((x) => x.fill(0));

    this.ctx.fillStyle = PIECES[0].clr;
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

  coords_fill(coords, name) {
    this.ctx.fillStyle = PIECES[name].clr;
    for (let [x, y] of coords.map(c => this.coord_to_px(c)))
      this.ctx.fillRect(
        x, y,
        this.blk_width, this.blk_width
      );
  }

  coords_set(coords, name) {
    this.coords_fill(coords, name);
    for (const [x, y] of coords)
      this.field[x][y] = name;
  }
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

class State {
  constructor(id, dims) {
    this.name   = null; // piece name
    this.p      = null; // piece
    this.onLoss = () => {};
    this.field  = new Field(id, dims);
  }

  rst() {
    this.field.clear();
    this.new_pc();
  }

  grav() {
    if (!this.drop())
      this.next_pc();
  }

  hard_drop() {
    while (this.drop()); // null statement
    this.next_pc();
  }

  next_pc() { this.set_pc(); this.new_pc(); }

  drop() {
    const n = Piece.trans(this.p, [0, -1]).coords;
    if (this.field.coords_free(n)) {
      this.trans([0, -1]);
      return true;
    }
    return false;
  }

  new_pc() {
    this.name = pick_piece();
    this.p    = new Piece(PIECES[this.name].blk, [4, this.field.height - 2]);

    if (!this.field.coords_free(this.p.coords)) {
      this.onLoss()
      return;
    }

    this.field.coords_fill(this.p.coords, this.name);
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

  reload() {
    this.field.reset_dims();
    this.field.redraw();
    this.field.coords_fill(this.p.coords, this.name);
  }

  _mv(f) {
    this.field.coords_fill(this.p.coords, 0);
    this.p = f(this.p);
    this.field.coords_fill(this.p.coords, this.name);
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

function run(st) {
  let keyDown = {};
  let gId     = null;
  let pause   = null;

  let start = () => { pause = null; gId = setInterval(() => st.grav(), 1000); }
  let stop  = () => { pause = true; clearInterval(gId); }

  let doTrans = (delay, i, trans) => {
    if (keyDown[i]) return;
    keyDown[i] = true;
    (function f() {
      if (keyDown[i]) {
        trans();
        setTimeout(f, delay);
      }
    })();
  }

  let keydownCB = (e) => {
    switch (e.key) {
      case ' '         : st.hard_drop(); break;
      case 'ArrowUp'   :
      case 'x'         : st.rotr(); break;
      case 'z'         : st.rotl(); break;
      case 'ArrowLeft' :
        doTrans(110, e.key, () => st.trans([-1,+0]));
        keyDown['ArrowRight'] = false;
        break;
      case 'ArrowRight':
        doTrans(110, e.key, () => st.trans([+1,+0]));
        keyDown['ArrowLeft'] = false;
        break;
      case 'ArrowDown' : doTrans(65, e.key, () => st.grav()); break;
      case 'p'         :
        pause ? start() : stop();
        console.log(`paused: ${!!pause}`)
        break;
    }
  };

  let keyupCB = (e) => {
    keyDown[e.key] && (keyDown[e.key] = false);
  };

  st.onLoss = () => {
    clearInterval(gId);
    document.removeEventListener('keydown', keydownCB);
    document.removeEventListener('keyup', keyupCB);
  }

  document.addEventListener('keydown', keydownCB);
  document.addEventListener('keyup', keyupCB);

  st.rst();
  start();
}

function main(id) {
  let st = new State(id, [10, 20]);
  window.onload = window.onresize = () => st.reload();

  document.addEventListener('keydown', (e) => {
    if (e.key === 'r') {
      st.onLoss(); // clean up
      run(st);
    }
  });

  // Sets callbacks and returns
  run(st);
}
