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
    return {
      clr:   null, // colour
      name:  null, // piece name
      p:     null, // piece
      loss:  false,
      field: new Field(id, dims, bg),
    }
  }

  static rst(st) {
    st.field.clear();
    this.new_pc(st)
  }

  static tick(st) {
    const n = Piece.trans(st.p, [0, -1]).coords;
    if (st.field.coords_free(n)) {
      this.trans(st, [0, -1]);
      return;
    }
    this.set_pc(st)
    this.new_pc(st)
  }

  static new_pc(st) {
    st.name = pick_elem(PIECE_NAMES);
    st.clr  = PIECES[st.name].clr;
    st.p    = new Piece(PIECES[st.name].blk, [4, st.field.height - 2]);

    if (!st.field.coords_free(st.p.coords)) {
      st.loss = true;
      return;
    }

    st.field.coords_fill(st.p.coords, st.clr);
  }

  static set_pc(st) {
    st.field.coords_set(st.p.coords, st.name);

    let cleared = st.p.coords
      .map(([_, y]) => y)
      .filter(y => {
        for (let x = 0; x < st.field.width; ++x)
          if (st.field.coord_free([x, y]))
            return false;
        return true;
      })
      .sort((a, b) => b - a); // reverse sort

    cleared = new Set(cleared)

    for (const y of cleared)
      this.clear_row(st, y)
  }

  static clear_row(st, y) {
    for (; y < st.field.height - 1; ++y)
      for (let x = 0; x < st.field.width; ++x)
        if (st.field.field[x][y] !== st.field.field[x][y+1])
          st.field.coords_set(
            [[x, y]],
            st.field.field[x][y+1]
          );
  }

  static _mv(st, f) {
    st.field.coords_unfill(st.p.coords);
    st.p = f(st.p);
    st.field.coords_fill(st.p.coords, st.clr);
  }

  static trans(st, [dx, dy]) {
    this._mv(st, (p) => {
      let np = Piece.trans(p, [dx, dy]);

      if (st.field.coords_free(np.coords))
        return np;
      else
        return p;
    });
  }

  static rotr(st) {
    this._mv(st, (p) => {
      let np = Piece.rotr(p);
      let offs =
        get_offsets(st.name, p.st, np.st)
        .map(off => Piece.trans(np, off));

      for (const x of offs)
        if (st.field.coords_free(x.coords))
          return x;

      return p;
    });
  }
}

async function main(id) {
  let st = new State(id, [10, 20], '#eeeeee')
  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowLeft'  : State.trans(st, [-1, +0]); break;
      case 'ArrowRight' : State.trans(st, [+1, +0]); break;
      case 'ArrowDown'  : State.trans(st, [+0, -1]); break;
      case 'ArrowUp'    : State.rotr(st);            break;
    }
  });

  State.rst(st)
  while (!st.loss) {
    await sleep(1000);
    State.tick(st)
  }

  console.log(":(")
}
