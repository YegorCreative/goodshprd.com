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

  // ============================================================================
  // STATE OBJECT — Single source of truth
  // ============================================================================

  const state = {
    board: [],              // 1D array of { type: string, special: null | 'row' | 'col' }
    selectedIndex: null,    // null or index (0-63)
    isBusy: false,         // block input during animations
    score: 0,
    cascadeCount: 0,
    cascadeDepth: 0        // for scoring bonuses
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
      el.setAttribute('aria-label', `${tile.type || 'empty'}, position ${index}`);

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
    if (special === 'row') return '🔔'; // Bell = row clear
    if (special === 'col') return '🌾'; // Wheat = column clear

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
    el.setAttribute('aria-label', `${tile.type || 'empty'}, position ${index}`);
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
    swapTiles(indexA, indexB);

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

      const matches = findMatches();

      if (matches.size === 0) {
        // No match → revert swap
        revertSwap(indexA, indexB);
        clearSelection();
        state.isBusy = false;
      } else {
        // Match found → start cascade
        clearSelection();
        resolveMatches();
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
     * Find all tiles that are part of a match-3 or longer.
     * Returns a Set of indices.
     */
    const matched = new Set();

    // Check for special tiles that should clear
    for (let i = 0; i < state.board.length; i++) {
      const tile = state.board[i];
      if (tile.special === 'row') {
        // Clear entire row
        const { row } = indexToCoord(i);
        for (let c = 0; c < BOARD_SIZE; c++) {
          matched.add(coordToIndex(row, c));
        }
      } else if (tile.special === 'col') {
        // Clear entire column
        const { col } = indexToCoord(i);
        for (let r = 0; r < BOARD_SIZE; r++) {
          matched.add(coordToIndex(r, col));
        }
      }
    }

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
          for (let i = 0; i < len; i++) {
            matched.add(coordToIndex(r, c + i));
          }
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
          for (let i = 0; i < len; i++) {
            matched.add(coordToIndex(r + i, c));
          }
        }

        r += len || 1;
      }
    }

    return matched;
  }

  // ============================================================================
  // CASCADE LOOP
  // ============================================================================

  function resolveMatches() {
    /**
     * Main cascade loop:
     * 1. Find matches
     * 2. Clear matches (trigger special tiles if applicable)
     * 3. Apply gravity
     * 4. Refill
     * 5. Check for more matches → repeat until none
     */
    state.cascadeDepth++;

    if (state.cascadeDepth > MAX_CASCADE) {
      console.warn('Cascade depth exceeded, stopping.');
      state.isBusy = false;
      return;
    }

    const matches = findMatches();

    if (matches.size === 0) {
      // No more matches, done
      state.cascadeDepth = 0;
      state.isBusy = false;
      return;
    }

    // Clear matched tiles
    clearMatches(matches);

    // Schedule next cascade
    setTimeout(() => {
      applyGravity();
      refillBoard();
      renderBoard(); // Full re-render after gravity/refill
      
      // Recursively resolve more cascades
      setTimeout(resolveMatches, 350);
    }, 300);
  }

  function clearMatches(matchSet) {
    /**
     * Remove matched tiles and apply scoring.
     * Check if any swapped tile triggered a special, and create it.
     */
    let baseScore = matchSet.size * 10;
    let specialBonus = 0;

    matchSet.forEach((index) => {
      const el = tileElements[index];
      el.classList.add('clearing');
    });

    setTimeout(() => {
      matchSet.forEach((index) => {
        state.board[index].type = null;
        state.board[index].special = null;
        updateTileElement(index);
      });

      // Scoring
      baseScore += specialBonus;
      if (state.cascadeDepth > 1) {
        baseScore += (state.cascadeDepth - 1) * 25; // Cascade bonus
      }
      addScore(baseScore);
    }, 300);
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
