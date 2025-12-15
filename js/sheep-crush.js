/* Sheep Crush — Vanilla JS match-3 (8x8) */
(function() {
  const SIZE = 8;
  const TYPES = [
    'sheep-cream','sheep-olive','sheep-rust','sheep-sky','sheep-dark',
    'bell','wheat'
  ];
  const NORMAL_TYPES = ['sheep-cream','sheep-olive','sheep-rust','sheep-sky','sheep-dark'];
  const SPECIAL_BELL = 'bell';
  const SPECIAL_WHEAT = 'wheat';

  let board = []; // 2D array of tile objects {type, row, col, el}
  let score = 0;
  let selected = null; // {row,col}
  let busy = false;

  const boardEl = document.getElementById('scBoard');
  const scoreEl = document.getElementById('scScore');
  const resetBtn = document.getElementById('scReset');

  function rand(n) { return Math.floor(Math.random()*n); }
  function choice(arr) { return arr[rand(arr.length)]; }

  function init() {
    score = 0; updateScore(0);
    selected = null; busy = false;
    board = Array.from({length: SIZE}, (_, r) => Array.from({length: SIZE}, (_, c) => ({type: null, row: r, col: c, el: null})));
    boardEl.innerHTML = '';
    boardEl.style.gridTemplateColumns = `repeat(${SIZE}, var(--tile-size))`;
    boardEl.style.gridTemplateRows = `repeat(${SIZE}, var(--tile-size))`;
    // Fill with random tiles, avoiding initial matches
    for (let r=0;r<SIZE;r++) {
      for (let c=0;c<SIZE;c++) {
        const t = randomNonMatchingType(r,c);
        placeTile(r,c,t);
      }
    }
    attachHandlers();
  }

  function randomTileType() {
    // Reduce frequency of specials; 10% chance
    const isSpecial = Math.random() < 0.10;
    if (!isSpecial) return choice(NORMAL_TYPES);
    return Math.random() < 0.5 ? SPECIAL_BELL : SPECIAL_WHEAT;
  }

  function randomNonMatchingType(r,c) {
    let t;
    do { t = randomTileType(); }
    while (createsImmediateMatch(r,c,t));
    return t;
  }

  function createsImmediateMatch(r,c,t) {
    // Check left and up only for initial fill
    const left1 = c>1 && board[r][c-1].type === t && board[r][c-2].type === t;
    const up1 = r>1 && board[r-1][c].type === t && board[r-2][c].type === t;
    return left1 || up1;
  }

  function placeTile(r,c,type) {
    const tile = board[r][c];
    tile.type = type;
    const el = document.createElement('button');
    el.className = `sc-tile tile-${type}`;
    el.setAttribute('role','gridcell');
    el.setAttribute('aria-label', type);
    el.dataset.row = r;
    el.dataset.col = c;
    el.tabIndex = 0;
    el.innerHTML = glyphFor(type);
    boardEl.appendChild(el);
    tile.el = el;
  }

  function glyphFor(type) {
    // Minimal geometric glyphs by type
    if (type === SPECIAL_BELL) return '<span class="glyph bar"></span>';
    if (type === SPECIAL_WHEAT) return '<span class="glyph square"></span>';
    // Sheep variants use circles/rings
    switch(type){
      case 'sheep-dark': return '<span class="glyph ring"></span>';
      default: return '<span class="glyph circle"></span>';
    }
  }

  function attachHandlers() {
    boardEl.addEventListener('click', onTileClick);
    resetBtn.addEventListener('click', () => init());
  }

  function onTileClick(e) {
    const tileEl = e.target.closest('.sc-tile');
    if (!tileEl || busy) return;
    const r = parseInt(tileEl.dataset.row,10);
    const c = parseInt(tileEl.dataset.col,10);
    const coord = {row:r,col:c};

    if (!selected) {
      selected = coord;
      tileAt(coord).el.classList.add('selected');
      return;
    }

    // If tapping same tile, deselect
    if (selected.row === r && selected.col === c) {
      tileAt(selected).el.classList.remove('selected');
      selected = null; return;
    }

    // Must be adjacent
    if (!isAdjacent(selected, coord)) {
      tileAt(selected).el.classList.remove('selected');
      selected = coord;
      tileAt(selected).el.classList.add('selected');
      return;
    }

    // Attempt swap
    swapAndResolve(selected, coord);
  }

  function tileAt({row,col}) { return board[row][col]; }
  function isAdjacent(a,b) { return Math.abs(a.row-b.row)+Math.abs(a.col-b.col) === 1; }

  function swapAndResolve(a,b) {
    busy = true;
    // Visual preview
    tileAt(a).el.classList.add('swap-preview');
    tileAt(b).el.classList.add('swap-preview');

    swapTypes(a,b);

    // Check matches after swap
    const matches = findAllMatches();
    if (matches.length === 0) {
      // revert
      setTimeout(() => {
        swapTypes(a,b);
        tileAt(a).el.classList.remove('swap-preview','selected');
        tileAt(b).el.classList.remove('swap-preview');
        selected = null; busy = false;
      }, 150);
      return;
    }

    // Resolve
    clearMatches(matches);
  }

  function swapTypes(a,b) {
    const ta = tileAt(a); const tb = tileAt(b);
    const tmp = ta.type; ta.type = tb.type; tb.type = tmp;
    ta.el.className = `sc-tile tile-${ta.type}`; ta.el.innerHTML = glyphFor(ta.type);
    tb.el.className = `sc-tile tile-${tb.type}`; tb.el.innerHTML = glyphFor(tb.type);
  }

  function findAllMatches() {
    const toClear = [];

    // Special tiles: add effects immediately
    // Bell clears row
    for (let r=0;r<SIZE;r++) {
      for (let c=0;c<SIZE;c++) {
        const t = board[r][c].type;
        if (t === SPECIAL_BELL) {
          toClear.push(...Array.from({length:SIZE}, (_,cc)=>({row:r,col:cc})));
        }
        if (t === SPECIAL_WHEAT) {
          toClear.push(...Array.from({length:SIZE}, (_,rr)=>({row:rr,col:c})));
        }
      }
    }

    // Normal match-3 detection (rows)
    for (let r=0;r<SIZE;r++) {
      let runType = null; let runStart = 0; let runLen = 0;
      for (let c=0;c<SIZE;c++) {
        const t = board[r][c].type;
        if (t && NORMAL_TYPES.includes(t)) {
          if (t === runType) { runLen++; }
          else { runType = t; runStart = c; runLen = 1; }
        } else { // break
          if (runLen >= 3) for (let cc=runStart; cc<runStart+runLen; cc++) toClear.push({row:r,col:cc});
          runType = null; runLen = 0;
        }
      }
      if (runLen >= 3) for (let cc=runStart; cc<runStart+runLen; cc++) toClear.push({row:r,col:cc});
    }

    // Columns
    for (let c=0;c<SIZE;c++) {
      let runType = null; let runStart = 0; let runLen = 0;
      for (let r=0;r<SIZE;r++) {
        const t = board[r][c].type;
        if (t && NORMAL_TYPES.includes(t)) {
          if (t === runType) { runLen++; }
          else { runType = t; runStart = r; runLen = 1; }
        } else {
          if (runLen >= 3) for (let rr=runStart; rr<runStart+runLen; rr++) toClear.push({row:rr,col:c});
          runType = null; runLen = 0;
        }
      }
      if (runLen >= 3) for (let rr=runStart; rr<runStart+runLen; rr++) toClear.push({row:rr,col:c});
    }

    // Deduplicate positions
    const key = p=>`${p.row},${p.col}`;
    const set = new Set(toClear.map(key));
    return Array.from(set).map(k=>({row:+k.split(',')[0], col:+k.split(',')[1]}));
  }

  function clearMatches(cells) {
    // Visual marking
    cells.forEach(({row,col}) => board[row][col].el.classList.add('clearing'));
    updateScore(cells.length);

    setTimeout(() => {
      // Remove tiles
      cells.forEach(({row,col}) => {
        const tile = board[row][col];
        tile.type = null;
        tile.el.className = 'sc-tile';
        tile.el.innerHTML = '';
      });
      // Collapse and refill
      collapseColumns();
      refill();
      // After refill, check for cascades
      const next = findAllMatches();
      if (next.length > 0) {
        clearMatches(next);
      } else {
        // Done
        selected && tileAt(selected).el.classList.remove('selected');
        selected = null; busy = false;
        // remove temp classes
        document.querySelectorAll('.swap-preview').forEach(el=>el.classList.remove('swap-preview'));
        document.querySelectorAll('.clearing').forEach(el=>el.classList.remove('clearing'));
      }
    }, 180);
  }

  function collapseColumns() {
    for (let c=0;c<SIZE;c++) {
      let write = SIZE-1;
      for (let r=SIZE-1; r>=0; r--) {
        if (board[r][c].type !== null) {
          if (write !== r) moveTile({row:r,col:c}, {row:write,col:c});
          write--;
        }
      }
      // Fill remaining with nulls up to write
      for (let r=write; r>=0; r--) {
        board[r][c].type = null;
        board[r][c].el.className = 'sc-tile';
        board[r][c].el.innerHTML = '';
      }
    }
  }

  function moveTile(from,to) {
    const a = tileAt(from); const b = tileAt(to);
    b.type = a.type; b.el.className = `sc-tile tile-${b.type}`; b.el.innerHTML = glyphFor(b.type);
    a.type = null; a.el.className = 'sc-tile'; a.el.innerHTML = '';
  }

  function refill() {
    for (let c=0;c<SIZE;c++) {
      for (let r=0;r<SIZE;r++) {
        if (board[r][c].type === null) {
          const t = randomTileType();
          board[r][c].type = t;
          board[r][c].el.className = `sc-tile tile-${t}`;
          board[r][c].el.innerHTML = glyphFor(t);
        }
      }
    }
  }

  function updateScore(add) {
    score += add;
    scoreEl.textContent = score;
  }

  // Keyboard accessibility (optional)
  document.addEventListener('keydown', (e) => {
    if (busy) return;
    if (e.key === 'Escape' && selected) {
      tileAt(selected).el.classList.remove('selected');
      selected = null;
    }
  });

  // Initialize when DOM ready
  document.addEventListener('DOMContentLoaded', init);
})();
