/**
 * SHEEP CRUSH — Production-Quality Match-3 Engine
 * 
 * This is a complete rewrite with:
 * - Clean state management (single state object)
 * - Proper cascade logic with special tiles
 * - Mobile-first tap controls
 * - Scoring with bonuses
 * - Animation hooks for CSS transitions
 * 
 * The engine uses a 1D array for the board (8x8 = 64 tiles),
 * with helper functions to convert between 1D index and 2D (row, col).
 */

(function() {
  'use strict';

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  const BOARD_SIZE = 8;
  const BASE_TYPES = [
    'sheep-cream',
    'sheep-olive',
    'sheep-rust',
    'sheep-sky',
    'sheep-dark'
  ];
  const MATCH_MIN = 3;
  const MAX_CASCADE = 20;
  const ANIMATION_DURATION = 300;
  const CLEAR_ANIMATION_MS = 300;

  // ============================================================================
  // STATE OBJECT — Single source of truth
  // ============================================================================

  const state = {
    board: [],              // 1D array of { type: string, special: null | 'row' | 'col' }
    selectedIndex: null,    // null or index (0-63)
    isBusy: false,          // block input during animations
    score: 0,
    cascadeDepth: 0,        // for scoring bonuses
    lastSwap: null,         // {a:number, b:number} indices for destination priority
    lastSwapTypes: null,    // {typeA:string, typeB:string}
    specialCreatedThisMove: false
  };

  // ============================================================================
  // DOM REFERENCES
  // ============================================================================

  const boardEl = document.getElementById('scBoard');
  const scoreEl = document.getElementById('scScore');
  const resetBtn = document.getElementById('scReset');
  
  let tileElements = []; // cached tile DOM elements

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  function rand(max) {
    return Math.floor(Math.random() * max);
  }

  function choice(arr) {
    return arr[rand(arr.length)];
  }

  function indexToCoord(index) {
    return {
      row: Math.floor(index / BOARD_SIZE),
      col: index % BOARD_SIZE
    };
  }

  function coordToIndex(row, col) {
    return row * BOARD_SIZE + col;
  }

  function isValidCoord(row, col) {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
  }

  function areAdjacent(indexA, indexB) {
    const a = indexToCoord(indexA);
    const b = indexToCoord(indexB);
    const dist = Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
    return dist === 1;
  }

  // ============================================================================
  // BOARD INITIALIZATION
  // ============================================================================

  function buildInitialBoard() {
    /**
     * Create a new 8x8 board with no pre-existing matches.
     * Returns a 1D array of 64 tile objects.
     */
    state.board = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => ({
      type: null,
      special: null
    }));

    // Fill each position with a random type, avoiding initial matches
    for (let i = 0; i < state.board.length; i++) {
      state.board[i].type = randomNonMatchingType(i);
    }

    return state.board;
  }

  function randomTileType() {
    /**
     * Return a random base sheep type. 
     * (Special tiles are created only from matches, not on spawn.)
     */
    return choice(BASE_TYPES);
  }

  function randomNonMatchingType(forIndex) {
    /**
     * Generate a tile type that doesn't create an immediate match
     * when placed at forIndex.
     */
    let type;
    let attempts = 0;
    do {
      type = randomTileType();
      attempts++;
    } while (createsImmediateMatch(forIndex, type) && attempts < 20);

    return type;
  }

  function createsImmediateMatch(index, type) {
    /**
     * Check if placing `type` at `index` would create a 3-in-a-row.
     * Only checks left/up neighbors (faster, sufficient for initial fill).
     */
    const { row, col } = indexToCoord(index);

    // Check horizontal (left 2)
    if (col >= 2) {
      const left1 = coordToIndex(row, col - 1);
      const left2 = coordToIndex(row, col - 2);
      if (state.board[left1].type === type && state.board[left2].type === type) {
        return true;
      }
    }

    // Check vertical (up 2)
    if (row >= 2) {
      const up1 = coordToIndex(row - 1, col);
      const up2 = coordToIndex(row - 2, col);
      if (state.board[up1].type === type && state.board[up2].type === type) {
        return true;
      }
    }

    return false;
  }

  // ============================================================================
  // RENDERING
  // ============================================================================

  function renderBoard() {
    /**
     * Render the entire board from state.board into the DOM.
     * This is called once on init, and again after structural changes.
     */
    boardEl.innerHTML = '';
    tileElements = [];

    state.board.forEach((tile, index) => {
      const el = document.createElement('button');
      el.className = 'sc-tile';
      
      // Add type class
      if (tile.type) {
        el.classList.add(`tile-${tile.type}`);
      }

      // Add special class if needed
      if (tile.special) {
        el.classList.add(`special-${tile.special}`);
      }

      el.dataset.index = index;
      el.setAttribute('role', 'button');
      const {row, col} = indexToCoord(index);
      el.setAttribute('aria-label', `${tile.type || 'empty'}, row ${row+1}, column ${col+1}`);

      // Content: emoji glyph
      el.innerHTML = glyphFor(tile.type, tile.special);

      el.addEventListener('click', () => handleTileClick(index));

      boardEl.appendChild(el);
      tileElements[index] = el;
    });
  }

  function glyphFor(type, special) {
    /**
     * Return the emoji/symbol for a tile.
     */
    if (!type) return '';

    // If it's a special, show special symbol
    if (special === 'row') return '🔔';
    if (special === 'col') return '🌾';
    if (special === 'blast') return '🏮';
    if (special === 'color') return '🎺';

    // Otherwise, all sheep types show sheep emoji
    return '🐑';
  }

  function updateTileElement(index) {
    /**
     * Update a single tile element's DOM state based on state.board[index].
     * Faster than full re-render for small updates.
     */
    const tile = state.board[index];
    const el = tileElements[index];
    if (!el) return;

    el.className = 'sc-tile';
    if (tile.type) {
      el.classList.add(`tile-${tile.type}`);
    }
    if (tile.special) {
      el.classList.add(`special-${tile.special}`);
    }

    el.innerHTML = glyphFor(tile.type, tile.special);
    const {row, col} = indexToCoord(index);
    el.setAttribute('aria-label', `${tile.type || 'empty'}, row ${row+1}, column ${col+1}`);
  }

  // ============================================================================
  // USER INTERACTION
  // ============================================================================

  function handleTileClick(index) {
    /**
     * Handle a tap on a tile. 
     * - If no selection, select this tile.
     * - If same tile, deselect.
     * - If adjacent, attempt swap.
     * - If not adjacent, move selection.
     */
    if (state.isBusy) return;

    // No selection yet
    if (state.selectedIndex === null) {
      state.selectedIndex = index;
      tileElements[index].classList.add('selected');
      return;
    }

    // Tapping the same tile → deselect
    if (state.selectedIndex === index) {
      tileElements[index].classList.remove('selected');
      state.selectedIndex = null;
      return;
    }

    // Not adjacent → change selection
    if (!areAdjacent(state.selectedIndex, index)) {
      tileElements[state.selectedIndex].classList.remove('selected');
      state.selectedIndex = index;
      tileElements[index].classList.add('selected');
      return;
    }

    // Adjacent → attempt swap
    const a = state.selectedIndex;
    const b = index;
    attemptSwap(a, b);
  }

  function attemptSwap(indexA, indexB) {
    /**
     * Swap two tiles and check for matches.
     * If no match, revert the swap.
     * If match, resolve cascades.
     */
    state.isBusy = true;
    state.cascadeDepth = 0;

    // Perform the swap
    const typeA = state.board[indexA].type;
    const typeB = state.board[indexB].type;
    swapTiles(indexA, indexB);
    state.lastSwap = {a:indexA, b:indexB};
    state.lastSwapTypes = {typeA, typeB};

    // Animate swap visually
    const elA = tileElements[indexA];
    const elB = tileElements[indexB];
    
    const { row: rA, col: cA } = indexToCoord(indexA);
    const { row: rB, col: cB } = indexToCoord(indexB);
    
    let animA = '', animB = '';
    if (cB < cA) {
      animA = 'swapLeft';
      animB = 'swapRight';
    } else if (cB > cA) {
      animA = 'swapRight';
      animB = 'swapLeft';
    } else if (rB < rA) {
      animA = 'swapUp';
      animB = 'swapDown';
    } else if (rB > rA) {
      animA = 'swapDown';
      animB = 'swapUp';
    }

    elA.style.animation = `${animA} ${ANIMATION_DURATION}ms ease-out`;
    elB.style.animation = `${animB} ${ANIMATION_DURATION}ms ease-out`;

    // Wait for animation, then check matches
    setTimeout(() => {
      elA.style.animation = '';
      elB.style.animation = '';

      const context = { swapA:indexA, swapB:indexB, swappedTypes:{...state.lastSwapTypes} };
      const matchesInfo = findMatches();
      if (matchesInfo.matchedIndices.size === 0) {
        // No match → revert swap
        revertSwap(indexA, indexB);
        clearSelection();
        state.isBusy = false;
      } else {
        // Check for Golden Sheep combo (color + other special) on direct swap activation
        const comboHandled = maybeHandleGoldenSheepCombo(indexA, indexB);
        // Match found → start cascade
        clearSelection();
        resolveCascades(context, matchesInfo);
      }
    }, ANIMATION_DURATION);
  }

  function swapTiles(indexA, indexB) {
    /**
     * Swap the tile data at two indices.
     * DOM update happens in updateTileElement.
     */
    const tileA = state.board[indexA];
    const tileB = state.board[indexB];

    const tmpType = tileA.type;
    const tmpSpecial = tileA.special;

    tileA.type = tileB.type;
    tileA.special = tileB.special;

    tileB.type = tmpType;
    tileB.special = tmpSpecial;

    updateTileElement(indexA);
    updateTileElement(indexB);
  }

  function revertSwap(indexA, indexB) {
    /**
     * Swap back. Board was already swapped, so swap again to revert.
     */
    swapTiles(indexA, indexB);
    
    // Shake animation would go here (optional)
  }

  function clearSelection() {
    if (state.selectedIndex !== null) {
      tileElements[state.selectedIndex].classList.remove('selected');
      state.selectedIndex = null;
    }
  }

  // ============================================================================
  // MATCH DETECTION
  // ============================================================================

  function findMatches() {
    /**
     * Find matches (3+) horizontally/vertically.
     * Returns rich info: { matchedIndices:Set<number>, matchGroups:Array<{indices:number[],orientation:'row'|'col',length:number,type:string}> }
     */
    const matched = new Set();
    const groups = [];
    // Track per-tile participation in row/col groups to detect shapes (L/T)
    const hGroups = [];
    const vGroups = [];

    // Check horizontal matches
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; ) {
        const startIdx = coordToIndex(r, c);
        const type = state.board[startIdx].type;

        if (!type) {
          c++;
          continue;
        }

        let len = 1;
        while (c + len < BOARD_SIZE && state.board[coordToIndex(r, c + len)].type === type) {
          len++;
        }

        if (len >= MATCH_MIN) {
          const indices = [];
          for (let i = 0; i < len; i++) {
            const idx = coordToIndex(r, c + i);
            indices.push(idx);
            matched.add(idx);
          }
          const g = {indices, orientation:'row', length:len, type};
          groups.push(g);
          hGroups.push(g);
        }

        c += len || 1;
      }
    }

    // Check vertical matches
    for (let c = 0; c < BOARD_SIZE; c++) {
      for (let r = 0; r < BOARD_SIZE; ) {
        const startIdx = coordToIndex(r, c);
        const type = state.board[startIdx].type;

        if (!type) {
          r++;
          continue;
        }

        let len = 1;
        while (r + len < BOARD_SIZE && state.board[coordToIndex(r + len, c)].type === type) {
          len++;
        }

        if (len >= MATCH_MIN) {
          const indices = [];
          for (let i = 0; i < len; i++) {
            const idx = coordToIndex(r + i, c);
            indices.push(idx);
            matched.add(idx);
          }
          const g = {indices, orientation:'col', length:len, type};
          groups.push(g);
          vGroups.push(g);
        }

        r += len || 1;
      }
    }

    // Detect shape (L/T) groups: overlapping row+col groups of the same type
    const shapeGroups = [];
    for (const hg of hGroups) {
      for (const vg of vGroups) {
        if (hg.type !== vg.type) continue;
        const overlap = hg.indices.find(i => vg.indices.includes(i));
        if (overlap !== undefined) {
          const indices = Array.from(new Set([...hg.indices, ...vg.indices]));
          const g = {indices, orientation:'shape', length:indices.length, type:hg.type};
          shapeGroups.push(g);
        }
      }
    }
    for (const sg of shapeGroups) {
      groups.push(sg);
      sg.indices.forEach(i => matched.add(i));
    }

    return { matchedIndices: matched, matchGroups: groups };
  }

  // ============================================================================
  // CASCADE LOOP (ASYNC, DETERMINISTIC)
  // ============================================================================

  const sleep = (ms) => new Promise(res => setTimeout(res, ms));

  async function resolveCascades(context, initialMatchInfo) {
    state.isBusy = true;
    state.cascadeDepth = 0;
    state.specialCreatedThisMove = false;

    while (true) {
      const info = initialMatchInfo || findMatches();
      initialMatchInfo = null;

      // Decide special creation once per player move, using anchor rules and priority
      let anchor = null;
      let createdSpecialIndex = null;
      if (!state.specialCreatedThisMove && info.matchedIndices.size > 0) {
        anchor = chooseAnchorForCreation(info, context.swapA, context.swapB);
        createdSpecialIndex = maybeCreateSpecialAtAnchor(info, anchor);
        if (createdSpecialIndex !== null) {
          state.specialCreatedThisMove = true;
        }
      }

      // Build clear set (exclude anchor if we created a special there)
      const initialSet = new Set(info.matchedIndices);
      if (createdSpecialIndex !== null) initialSet.delete(createdSpecialIndex);

      // Expand with specials
      const expanded = expandClearSetWithSpecials(initialSet, context);
      if (expanded.clearSet.size === 0) break;

      // Animate clear
      await animateClear(expanded.clearSet);

      // Scoring
      let points = expanded.clearSet.size * 10;
      points += expanded.specialTriggers * 50;
      if (state.cascadeDepth >= 1) points += state.cascadeDepth * 25;
      addScore(points);

      // Remove tiles
      expanded.clearSet.forEach(idx => {
        state.board[idx].type = null;
        state.board[idx].special = null;
      });

      // Gravity + refill
      applyGravity();
      refillBoard();
      renderBoard();

      state.cascadeDepth++;

      // Next iteration
      const next = findMatches();
      if (next.matchedIndices.size === 0) break;
      initialMatchInfo = next;
    }

    state.isBusy = false;
    state.lastSwap = null;
    state.lastSwapTypes = null;
    state.specialCreatedThisMove = false;
  }

  async function animateClear(clearSet) {
    clearSet.forEach((index) => {
      const el = tileElements[index];
      if (el) el.classList.add('clearing');
    });
    await sleep(CLEAR_ANIMATION_MS);
  }

  function applyGravity() {
    /**
     * Drop all tiles down, filling empty spaces.
     * Process column by column.
     */
    for (let c = 0; c < BOARD_SIZE; c++) {
      const column = [];
      
      // Collect non-null tiles
      for (let r = 0; r < BOARD_SIZE; r++) {
        const tile = state.board[coordToIndex(r, c)];
        if (tile.type) {
          column.push({ ...tile });
        }
      }

      // Write back from bottom
      for (let r = 0; r < BOARD_SIZE; r++) {
        const idx = coordToIndex(r, c);
        if (r < BOARD_SIZE - column.length) {
          state.board[idx].type = null;
          state.board[idx].special = null;
        } else {
          const tile = column[r - (BOARD_SIZE - column.length)];
          state.board[idx].type = tile.type;
          state.board[idx].special = tile.special;
        }
      }
    }
  }

  function refillBoard() {
    /**
     * Fill empty spaces with new random tiles.
     * Make sure they don't create immediate matches.
     */
    for (let i = 0; i < state.board.length; i++) {
      if (!state.board[i].type) {
        state.board[i].type = randomNonMatchingType(i);
        state.board[i].special = null;
      }
    }
  }

  function addScore(points) {
    state.score += points;
    scoreEl.textContent = state.score;
  }

  // ============================================================================
  // SPECIALS: CREATION & EXPANSION
  // ============================================================================

  function chooseAnchorForCreation(matchInfo, swapA, swapB) {
    // Prefer swapB (destination) if part of any group; else swapA if part; else null
    const inGroups = (idx) => matchInfo.matchGroups.some(g => g.indices.includes(idx));
    if (inGroups(swapB)) return swapB;
    if (inGroups(swapA)) return swapA;
    return null;
  }

  function maybeCreateSpecialAtAnchor(matchInfo, anchorIndex) {
    if (anchorIndex === null) return null;
    const tile = state.board[anchorIndex];
    if (!tile) return null;

    // Determine highest-priority group involving the anchor
    const groups = matchInfo.matchGroups.filter(g => g.indices.includes(anchorIndex));
    if (groups.length === 0) return null;

    // Priority: shape → 5-line → 4-row → 4-col
    let chosen = null;
    // shape
    chosen = groups.find(g => g.orientation === 'shape');
    if (!chosen) {
      // 5-line
      chosen = groups.find(g => g.length >= 5);
    }
    if (!chosen) {
      // 4-row
      chosen = groups.find(g => g.length === 4 && g.orientation === 'row');
    }
    if (!chosen) {
      // 4-col
      chosen = groups.find(g => g.length === 4 && g.orientation === 'col');
    }
    if (!chosen) return null;

    // Create special and keep anchor tile type
    if (chosen.orientation === 'shape') {
      tile.special = 'blast';
    } else if (chosen.length >= 5) {
      tile.special = 'color';
    } else if (chosen.length === 4 && chosen.orientation === 'row') {
      tile.special = 'row';
    } else if (chosen.length === 4 && chosen.orientation === 'col') {
      tile.special = 'col';
    }

    return anchorIndex;
  }

  function expandClearSetWithSpecials(initialSet, swapContext) {
    const clearSet = new Set(initialSet);
    let specialTriggers = 0;

    const queue = Array.from(clearSet);
    const seen = new Set(queue);

    const addIndex = (i) => {
      if (!clearSet.has(i)) {
        clearSet.add(i);
        if (!seen.has(i)) { seen.add(i); queue.push(i); }
      }
    };

    while (queue.length) {
      const idx = queue.shift();
      const t = state.board[idx];
      if (!t) continue;

      if (t.special === 'row') {
        const {row} = indexToCoord(idx);
        for (let c=0;c<BOARD_SIZE;c++) addIndex(coordToIndex(row,c));
        specialTriggers++;
      } else if (t.special === 'col') {
        const {col} = indexToCoord(idx);
        for (let r=0;r<BOARD_SIZE;r++) addIndex(coordToIndex(r,col));
        specialTriggers++;
      } else if (t.special === 'blast') {
        const {row,col} = indexToCoord(idx);
        for (let dr=-1; dr<=1; dr++) {
          for (let dc=-1; dc<=1; dc++) {
            const rr = row+dr, cc = col+dc;
            if (isValidCoord(rr,cc)) addIndex(coordToIndex(rr,cc));
          }
        }
        specialTriggers++;
      } else if (t.special === 'color') {
        // Determine target color type
        let targetType = null;
        if (swapContext && (swapContext.swapA === idx || swapContext.swapB === idx)) {
          // Triggered by swap: use swapped-with tile's type
          const otherIdx = (swapContext.swapA === idx) ? swapContext.swapB : swapContext.swapA;
          targetType = state.board[otherIdx]?.type || swapContext.swappedTypes?.typeA || swapContext.swappedTypes?.typeB;
        }
        if (!targetType) {
          // Triggered by being hit: use its own type if present, else pick a random base
          targetType = t.type || choice(BASE_TYPES);
        }

        for (let i=0; i<state.board.length; i++) {
          if (state.board[i].type === targetType) addIndex(i);
        }
        specialTriggers++;
      }
    }

    return { clearSet, specialTriggers };
  }

  function maybeHandleGoldenSheepCombo(indexA, indexB) {
    // If a color special is swapped with row/col/blast, convert all tiles of the other tile's type into that special, then trigger
    const a = state.board[indexA];
    const b = state.board[indexB];
    const isColorA = a.special === 'color';
    const isColorB = b.special === 'color';
    const otherSpecialType = (s) => (s === 'row' || s === 'col' || s === 'blast');

    if (isColorA && otherSpecialType(b.special)) {
      const targetType = b.type;
      if (!targetType) return false;
      for (let i=0; i<state.board.length; i++) {
        if (state.board[i].type === targetType) {
          state.board[i].special = b.special;
        }
      }
      // Trigger them all immediately by adding all targetType indices to clear set and expanding
      const initial = new Set();
      for (let i=0; i<state.board.length; i++) {
        if (state.board[i].type === targetType) initial.add(i);
      }
      const expanded = expandClearSetWithSpecials(initial, {swapA:indexA, swapB:indexB, swappedTypes:state.lastSwapTypes});
      // Animate and clear synchronously to reflect combo before normal cascade
      // Note: scoring handled in cascade loop, so we just mark tiles here and let cascade handle removal
      expanded.clearSet.forEach(idx => {
        const el = tileElements[idx];
        if (el) el.classList.add('clearing');
      });
      return true;
    }

    if (isColorB && otherSpecialType(a.special)) {
      const targetType = a.type;
      if (!targetType) return false;
      for (let i=0; i<state.board.length; i++) {
        if (state.board[i].type === targetType) {
          state.board[i].special = a.special;
        }
      }
      const initial = new Set();
      for (let i=0; i<state.board.length; i++) {
        if (state.board[i].type === targetType) initial.add(i);
      }
      const expanded = expandClearSetWithSpecials(initial, {swapA:indexA, swapB:indexB, swappedTypes:state.lastSwapTypes});
      expanded.clearSet.forEach(idx => {
        const el = tileElements[idx];
        if (el) el.classList.add('clearing');
      });
      return true;
    }

    // Whistle + Whistle: clear entire board
    if (isColorA && isColorB) {
      for (let i=0; i<state.board.length; i++) {
        // add all to clear; cascade will remove
        const el = tileElements[i];
        if (el) el.classList.add('clearing');
      }
      return true;
    }

    return false;
  }

  // ============================================================================
  // INITIALIZATION & RESET
  // ============================================================================

  function initGame() {
    /**
     * Initialize or reset the game.
     */
    state.board = [];
    state.selectedIndex = null;
    state.isBusy = false;
    state.score = 0;
    state.cascadeCount = 0;
    state.cascadeDepth = 0;
    state.lastSwap = null;
    state.lastSwapTypes = null;
    state.specialCreatedThisMove = false;

    buildInitialBoard();
    renderBoard();
    scoreEl.textContent = '0';
  }

  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================

  function attachHandlers() {
    resetBtn.addEventListener('click', initGame);

    // Keyboard support (optional)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.selectedIndex !== null) {
        tileElements[state.selectedIndex].classList.remove('selected');
        state.selectedIndex = null;
      }
    });
  }

  // ============================================================================
  // STARTUP
  // ============================================================================

  document.addEventListener('DOMContentLoaded', () => {
    attachHandlers();
    initGame();
  });
})();
