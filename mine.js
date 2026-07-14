(() => {
  const levels = {
    beginner: { rows: 9, cols: 9, bombs: 10 },
    intermediate: { rows: 16, cols: 16, bombs: 40 },
    expert: { rows: 24, cols: 24, bombs: 99 },
  };

  const boardElem = document.getElementById("game-board");
  const bombCountElem = document.getElementById("bomb-count");
  const timerElem = document.getElementById("timer");
  const restartBtn = document.getElementById("restart-btn");
  const difficultySelect = document.getElementById("difficulty");
  const overlay = document.getElementById("game-overlay");
  const overlayMessage = document.getElementById("overlay-message");
  const overlayRestartBtn = document.getElementById("overlay-restart-btn");
  const themeToggleBtn = document.getElementById("theme-toggle");

  // Sounds
  const soundClick = document.getElementById("sound-click");
  const soundFlag = document.getElementById("sound-flag");
  const soundBomb = document.getElementById("sound-bomb");
  const soundWin = document.getElementById("sound-win");

  let gameState = {
    board: [],
    rows: 0,
    cols: 0,
    bombs: 0,
    revealedCount: 0,
    flaggedCount: 0,
    gameOver: false,
    timer: null,
    timeElapsed: 0,
    firstClick: true,
  };

  function playSound(sound) {
    if (!sound) return;
    sound.currentTime = 0;
    sound.play().catch(() => {}); // fail silently if audio blocked
  }

  function createBoard(rows, cols, bombs) {
    gameState.rows = rows;
    gameState.cols = cols;
    gameState.bombs = bombs;
    gameState.revealedCount = 0;
    gameState.flaggedCount = 0;
    gameState.gameOver = false;
    gameState.timeElapsed = 0;
    gameState.firstClick = true;

    bombCountElem.textContent = `Bombs: ${bombs}`;
    timerElem.textContent = "Time: 0s";
    boardElem.className = `board ${difficultySelect.value}`;

    // Clear board
    boardElem.innerHTML = "";

    // Create 2D array
    gameState.board = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill().map(() => ({
        bomb: false,
        adjacentBombs: 0,
        revealed: false,
        flagged: false,
        elem: null,
      })));

    // Create DOM cells
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement("div");
        cell.classList.add("cell");
        cell.dataset.row = r;
        cell.dataset.col = c;
        cell.setAttribute("tabindex", 0);
        cell.setAttribute("role", "button");
        cell.setAttribute("aria-label", "Unrevealed cell");
        boardElem.appendChild(cell);
        gameState.board[r][c].elem = cell;
      }
    }
  }

  // Place bombs after first click to prevent immediate loss
  function placeBombs(excludeRow, excludeCol) {
    const { rows, cols, bombs, board } = gameState;
    let placed = 0;

    while (placed < bombs) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);

      // Skip the clicked cell and neighbors to avoid immediate bomb loss on first click
      if (board[r][c].bomb) continue;
      if (Math.abs(r - excludeRow) <= 1 && Math.abs(c - excludeCol) <= 1) continue;

      board[r][c].bomb = true;
      placed++;
    }

    calculateAdjacents();
  }

  function calculateAdjacents() {
    const { rows, cols, board } = gameState;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c].bomb) continue;

        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].bomb) {
              count++;
            }
          }
        }
        board[r][c].adjacentBombs = count;
      }
    }
  }

  // Reveal cell logic, flood fill zero neighbors
  function revealCell(r, c) {
    const cell = gameState.board[r][c];
    if (cell.revealed || cell.flagged || gameState.gameOver) return;

    if (gameState.firstClick) {
      placeBombs(r, c);
      startTimer();
      gameState.firstClick = false;
    }

    cell.revealed = true;
    gameState.revealedCount++;
    updateCellUI(cell);

    if (cell.bomb) {
      gameOver(false);
      return;
    }

    if (cell.adjacentBombs === 0) {
      // Flood fill neighbors
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (
            nr >= 0 &&
            nr < gameState.rows &&
            nc >= 0 &&
            nc < gameState.cols &&
            !gameState.board[nr][nc].revealed
          ) {
            revealCell(nr, nc);
          }
        }
      }
    }

    playSound(soundClick);
    checkWin();
  }

  // Update single cell UI based on state
  function updateCellUI(cell) {
    const elem = cell.elem;
    elem.classList.add("revealed");
    elem.classList.remove("flagged");
    elem.style.pointerEvents = "none";
    elem.setAttribute("aria-label", cell.bomb ? "Bomb" : `${cell.adjacentBombs} adjacent bombs`);

    if (cell.bomb) {
      elem.textContent = "💣";
      elem.classList.add("bomb");
    } else if (cell.adjacentBombs > 0) {
      elem.textContent = cell.adjacentBombs;
      elem.style.color = getNumberColor(cell.adjacentBombs);
    } else {
      elem.textContent = "";
    }
  }

  // Helper to get number colors like classic Minesweeper
  function getNumberColor(num) {
    const colors = [
      "", // 0 - no color
      "#1976d2", // 1 - blue
      "#388e3c", // 2 - green
      "#d32f2f", // 3 - red
      "#7b1fa2", // 4 - purple
      "#ff6f00", // 5 - orange
      "#00796b", // 6 - teal
      "#212121", // 7 - black
      "#616161", // 8 - gray
    ];
    return colors[num] || "#000";
  }

  // Toggle flag on right-click or Ctrl+click or Shift+click (for accessibility)
  function toggleFlag(r, c) {
    if (gameState.gameOver) return;

    const cell = gameState.board[r][c];
    if (cell.revealed) return;

    cell.flagged = !cell.flagged;
    if (cell.flagged) {
      cell.elem.classList.add("flagged");
      cell.elem.textContent = "🚩";
      playSound(soundFlag);
      gameState.flaggedCount++;
    } else {
      cell.elem.classList.remove("flagged");
      cell.elem.textContent = "";
      gameState.flaggedCount--;
    }

    bombCountElem.textContent = `Bombs: ${gameState.bombs - gameState.flaggedCount}`;
  }

  // Game over
  function gameOver(won) {
    gameState.gameOver = true;
    stopTimer();

    // Reveal all bombs
    for (let r = 0; r < gameState.rows; r++) {
      for (let c = 0; c < gameState.cols; c++) {
        const cell = gameState.board[r][c];
        if (cell.bomb && !cell.revealed) {
          cell.revealed = true;
          updateCellUI(cell);
        }
        // Disable pointer events on all cells
        cell.elem.classList.add("disabled");
      }
    }

    if (won) {
      overlayMessage.textContent = `🎉 You Win! Time: ${gameState.timeElapsed}s`;
      playSound(soundWin);
    } else {
      overlayMessage.textContent = "💥 You Lost! Try Again?";
      playSound(soundBomb);
    }
    overlay.classList.remove("hidden");
  }

  // Check win condition: revealedCount + bombs == total cells
  function checkWin() {
    if (gameState.revealedCount === gameState.rows * gameState.cols - gameState.bombs) {
      gameOver(true);
    }
  }

  // Timer functions
  function startTimer() {
    if (gameState.timer) return;
    gameState.timer = setInterval(() => {
      gameState.timeElapsed++;
      timerElem.textContent = `Time: ${gameState.timeElapsed}s`;
    }, 1000);
  }

  function stopTimer() {
    clearInterval(gameState.timer);
    gameState.timer = null;
  }

  // Handle cell clicks and right-clicks
  function onCellClick(e) {
    if (gameState.gameOver) return;

    const r = +e.target.dataset.row;
    const c = +e.target.dataset.col;

    if (e.type === "click") {
      if (e.ctrlKey || e.shiftKey || e.button === 2) {
        // Treat ctrl/shift + click as flag toggle for accessibility
        toggleFlag(r, c);
      } else {
        revealCell(r, c);
      }
    }
  }

  // Keyboard navigation & actions
  function onCellKeyDown(e) {
    const elem = e.target;
    if (!elem.classList.contains("cell")) return;

    const r = +elem.dataset.row;
    const c = +elem.dataset.col;
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        if (e.ctrlKey || e.shiftKey) {
          toggleFlag(r, c);
        } else {
          revealCell(r, c);
        }
        break;

      case "ArrowUp":
        e.preventDefault();
        if (r > 0) focusCell(r - 1, c);
        break;
      case "ArrowDown":
        e.preventDefault();
        if (r < gameState.rows - 1) focusCell(r + 1, c);
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (c > 0) focusCell(r, c - 1);
        break;
      case "ArrowRight":
        e.preventDefault();
        if (c < gameState.cols - 1) focusCell(r, c + 1);
        break;
    }
  }

  function focusCell(r, c) {
    const cell = gameState.board[r][c];
    if (cell && cell.elem) cell.elem.focus();
  }

  // Restart game
  function restartGame() {
    overlay.classList.add("hidden");
    createBoard(
      levels[difficultySelect.value].rows,
      levels[difficultySelect.value].cols,
      levels[difficultySelect.value].bombs
    );
    bombCountElem.textContent = `Bombs: ${levels[difficultySelect.value].bombs}`;
    timerElem.textContent = "Time: 0s";
  }

  // Toggle light/dark theme
  function toggleTheme() {
    document.body.classList.toggle("night");
  }

  // Event listeners
  boardElem.addEventListener("click", onCellClick);
  boardElem.addEventListener("contextmenu", (e) => e.preventDefault());
  boardElem.addEventListener("keydown", onCellKeyDown);

  restartBtn.addEventListener("click", restartGame);
  overlayRestartBtn.addEventListener("click", restartGame);
  difficultySelect.addEventListener("change", restartGame);
  themeToggleBtn.addEventListener("click", toggleTheme);

  // Initialize on page load
  restartGame();
})();
