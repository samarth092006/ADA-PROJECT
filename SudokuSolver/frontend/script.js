document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.getElementById('sudoku-grid');
    const statusText = document.getElementById('status-text');
    const scanLine = document.getElementById('scan-line');

    const btnSolve = document.getElementById('btn-solve');
    const btnVisualSolve = document.getElementById('btn-visual-solve');
    const btnValidate = document.getElementById('btn-validate');
    const btnVisualize = document.getElementById('btn-visualize');
    const btnLoad = document.getElementById('btn-load');
    const btnReset = document.getElementById('btn-reset');
    const speedSlider = document.getElementById('speed-slider');
    const speedLabel = document.getElementById('speed-label');

    const statAlgorithm = document.getElementById('stat-algorithm');
    const statTime = document.getElementById('stat-time');
    const statSteps = document.getElementById('stat-steps');
    const statBacktracks = document.getElementById('stat-backtracks');
    const statDifficulty = document.getElementById('stat-difficulty');
    const statStatus = document.getElementById('stat-status');

    const algorithmPanel = document.getElementById('algorithm-panel');
    const algorithmCurrent = document.getElementById('algorithm-current');
    const algorithmLog = document.getElementById('algorithm-log');
    const stepCounter = document.getElementById('step-counter');
    const stepProgress = document.getElementById('step-progress');
    const recursionTree = document.getElementById('recursion-tree');

    let selectedCell = null;
    let originalBoard = makeEmptyBoard();
    let currentBoard = makeEmptyBoard();
    let conflictCells = new Set();
    let isSolving = false;
    let visualSteps = [];
    let visualStats = createStats();
    let animationRunId = 0;

    const SAMPLE_BOARD = [
        [5, 3, 0, 0, 7, 0, 0, 0, 0],
        [6, 0, 0, 1, 9, 5, 0, 0, 0],
        [0, 9, 8, 0, 0, 0, 0, 6, 0],
        [8, 0, 0, 0, 6, 0, 0, 0, 3],
        [4, 0, 0, 8, 0, 3, 0, 0, 1],
        [7, 0, 0, 0, 2, 0, 0, 0, 6],
        [0, 6, 0, 0, 0, 0, 2, 8, 0],
        [0, 0, 0, 4, 1, 9, 0, 0, 5],
        [0, 0, 0, 0, 8, 0, 0, 7, 9]
    ];

    function makeEmptyBoard() {
        return Array(9).fill(null).map(() => Array(9).fill(0));
    }

    function cloneBoard(board) {
        return board.map(row => [...row]);
    }

    function createStats(overrides = {}) {
        return {
            algorithm: 'Backtracking',
            time: 0,
            steps: 0,
            backtracks: 0,
            difficulty: estimateDifficulty(currentBoard),
            status: 'Ready',
            recursiveCalls: 0,
            ...overrides
        };
    }

    function initGrid() {
        gridContainer.innerHTML = '';
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = r;
                cell.dataset.col = c;
                cell.addEventListener('click', () => selectCell(cell));
                gridContainer.appendChild(cell);
            }
        }
        updateGridDisplay({ animateSolved: false });
        updateStats(createStats());
        updateSpeedLabel();
    }

    function getCells() {
        return gridContainer.querySelectorAll('.cell');
    }

    function getCell(r, c) {
        return gridContainer.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
    }

    function updateGridDisplay(options = {}) {
        const { animateSolved = true } = options;
        getCells().forEach(cell => {
            const r = Number(cell.dataset.row);
            const c = Number(cell.dataset.col);
            const val = currentBoard[r][c];

            cell.textContent = val || '';
            cell.classList.remove('prefilled', 'solved-animate', 'conflict', 'valid-pulse', 'trying', 'backtracking');

            if (val !== 0) {
                if (originalBoard[r][c] !== 0) {
                    cell.classList.add('prefilled');
                } else if (animateSolved) {
                    cell.classList.add('solved-animate');
                }
            }

            if (conflictCells.has(cellKey(r, c))) {
                cell.classList.add('conflict');
            }
        });

        refreshHighlights();
    }

    function selectCell(cell) {
        if (isSolving) return;
        selectedCell = cell;
        refreshHighlights();
    }

    function refreshHighlights() {
        getCells().forEach(cell => {
            cell.classList.remove('selected', 'peer', 'row-col-highlight', 'box-highlight', 'same-number');
        });

        if (!selectedCell) return;

        const selectedRow = Number(selectedCell.dataset.row);
        const selectedCol = Number(selectedCell.dataset.col);
        const selectedValue = currentBoard[selectedRow][selectedCol];
        const boxRowStart = selectedRow - (selectedRow % 3);
        const boxColStart = selectedCol - (selectedCol % 3);

        getCells().forEach(cell => {
            const r = Number(cell.dataset.row);
            const c = Number(cell.dataset.col);
            const sameRow = r === selectedRow;
            const sameCol = c === selectedCol;
            const sameBox = r >= boxRowStart && r < boxRowStart + 3 && c >= boxColStart && c < boxColStart + 3;
            const sameNumber = selectedValue !== 0 && currentBoard[r][c] === selectedValue;

            if (cell === selectedCell) {
                cell.classList.add('selected');
                return;
            }
            if (sameBox) cell.classList.add('box-highlight', 'peer');
            if (sameRow || sameCol) cell.classList.add('row-col-highlight', 'peer');
            if (sameNumber) cell.classList.add('same-number');
        });
    }

    document.addEventListener('keydown', (e) => {
        if (!selectedCell || isSolving) return;

        const row = Number(selectedCell.dataset.row);
        const col = Number(selectedCell.dataset.col);

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            navigateToCell(row - 1, col);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            navigateToCell(row + 1, col);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            navigateToCell(row, col - 1);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            navigateToCell(row, col + 1);
        } else if (e.key >= '1' && e.key <= '9') {
            setCellValue(row, col, Number(e.key));
        } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
            setCellValue(row, col, 0);
        }
    });

    function navigateToCell(r, c) {
        if (r < 0 || r > 8 || c < 0 || c > 8) return;
        const nextCell = getCell(r, c);
        if (nextCell) selectCell(nextCell);
    }

    function setCellValue(r, c, val) {
        currentBoard[r][c] = val;
        originalBoard[r][c] = val;
        const result = validateBoard(currentBoard);
        conflictCells = result.conflicts;
        updateGridDisplay({ animateSolved: false });

        const changedCell = getCell(r, c);
        if (changedCell && val !== 0) {
            changedCell.classList.add(result.valid ? 'valid-pulse' : 'conflict');
        }

        if (result.valid) {
            setStatus(val === 0 ? 'Ready' : 'Valid input', val === 0 ? 'ready' : 'success');
            updateStats(createStats({ status: 'Valid', difficulty: estimateDifficulty(currentBoard) }));
        } else {
            setStatus(`Invalid Move: ${result.reason}`, 'invalid');
            updateStats(createStats({ status: 'Invalid', difficulty: estimateDifficulty(currentBoard) }));
        }
    }

    document.querySelectorAll('.key-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!selectedCell || isSolving) return;
            const row = Number(selectedCell.dataset.row);
            const col = Number(selectedCell.dataset.col);
            const val = btn.dataset.val === 'clear' ? 0 : Number(btn.dataset.val);
            setCellValue(row, col, val);
        });
    });

    speedSlider.addEventListener('input', updateSpeedLabel);

    function setStatus(text, type) {
        statusText.className = `status-text ${type}`;
        const icons = {
            ready: '<i class="fa-solid fa-circle-check"></i> ',
            solving: '<i class="fa-solid fa-spinner fa-spin"></i> ',
            success: '<i class="fa-solid fa-circle-check animate-pulse"></i> ',
            invalid: '<i class="fa-solid fa-triangle-exclamation"></i> '
        };
        statusText.innerHTML = (icons[type] || '') + text;
    }

    function toggleControls(enable) {
        isSolving = !enable;
        [btnSolve, btnVisualSolve, btnValidate, btnLoad, btnReset, btnVisualize, speedSlider].forEach(control => {
            control.disabled = !enable;
        });
        document.querySelectorAll('.key-btn').forEach(btn => {
            btn.disabled = !enable;
        });
        scanLine.classList.toggle('hidden', enable);
    }

    btnSolve.addEventListener('click', async () => {
        if (!prepareForSolve()) return;
        toggleControls(false);
        setStatus('Solving instantly...', 'solving');
        const start = performance.now();

        try {
            const response = await fetch('/solve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ board: currentBoard })
            });
            const result = await response.json();

            if (response.ok && result.solvedBoard) {
                currentBoard = result.solvedBoard;
                conflictCells = new Set();
                updateGridDisplay();
                const elapsed = (performance.now() - start) / 1000;
                updateStats(createStats({
                    time: result.stats?.time ?? elapsed,
                    steps: result.stats?.steps ?? result.stats?.recursiveCalls ?? 0,
                    backtracks: result.stats?.backtracks ?? 0,
                    recursiveCalls: result.stats?.recursiveCalls ?? result.stats?.steps ?? 0,
                    difficulty: result.stats?.difficulty ?? estimateDifficulty(originalBoard),
                    status: 'Solved'
                }));
                setStatus('Solved Successfully', 'success');
                pushAlgorithmLog('Solved', 'Instant solve returned the completed board.', 'solved');
            } else {
                const errMsg = result.details || result.error || 'Sudoku cannot be solved.';
                setStatus(errMsg, 'invalid');
                conflictCells = validateBoard(currentBoard).conflicts;
                updateGridDisplay({ animateSolved: false });
                updateStats(createStats({ status: 'Unsolvable' }));
            }
        } catch (err) {
            setStatus('Connection Error. Ensure server is running.', 'invalid');
            console.error(err);
        } finally {
            toggleControls(true);
        }
    });

    btnVisualSolve.addEventListener('click', async () => {
        if (!prepareForSolve()) return;
        toggleControls(false);
        setStatus('Visual solving...', 'solving');
        algorithmPanel.classList.remove('hidden');
        clearAlgorithmPanel();

        const startBoard = cloneBoard(currentBoard);
        const solveBoard = cloneBoard(currentBoard);
        visualSteps = [];
        visualStats = createStats({ status: 'Solving', difficulty: estimateDifficulty(startBoard) });
        const start = performance.now();
        const solved = solveWithTrace(solveBoard, 0);
        visualStats.time = (performance.now() - start) / 1000;
        visualStats.status = solved ? 'Solved' : 'Unsolvable';

        if (!solved) {
            setStatus('Unsolvable board', 'invalid');
            updateStats(visualStats);
            toggleControls(true);
            return;
        }

        currentBoard = cloneBoard(startBoard);
        updateGridDisplay({ animateSolved: false });
        await playVisualSteps(++animationRunId);
        toggleControls(true);
    });

    btnVisualize.addEventListener('click', () => {
        algorithmPanel.classList.toggle('hidden');
    });

    btnValidate.addEventListener('click', async () => {
        setStatus('Validating grid...', 'solving');
        const result = validateBoard(currentBoard);
        conflictCells = result.conflicts;
        updateGridDisplay({ animateSolved: false });

        if (result.valid) {
            setStatus('Valid Grid (No conflicts)', 'success');
            updateStats(createStats({ status: 'Valid', difficulty: estimateDifficulty(currentBoard) }));
        } else {
            setStatus(result.reason, 'invalid');
            updateStats(createStats({ status: 'Invalid', difficulty: estimateDifficulty(currentBoard) }));
        }

        try {
            await fetch('/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ board: currentBoard })
            });
        } catch (err) {
            console.warn('Server validation unavailable; local validation already completed.', err);
        }
    });

    btnLoad.addEventListener('click', () => {
        currentBoard = cloneBoard(SAMPLE_BOARD);
        originalBoard = cloneBoard(SAMPLE_BOARD);
        resetInteractionState();
        setStatus('Ready', 'ready');
        updateStats(createStats({ difficulty: estimateDifficulty(currentBoard), status: 'Ready' }));
    });

    btnReset.addEventListener('click', () => {
        currentBoard = makeEmptyBoard();
        originalBoard = makeEmptyBoard();
        resetInteractionState();
        setStatus('Ready', 'ready');
        updateStats(createStats({ difficulty: 'Empty', status: 'Ready' }));
    });

    function prepareForSolve() {
        const result = validateBoard(currentBoard);
        conflictCells = result.conflicts;
        updateGridDisplay({ animateSolved: false });

        if (!result.valid) {
            setStatus(`Invalid Move: ${result.reason}`, 'invalid');
            updateStats(createStats({ status: 'Invalid', difficulty: estimateDifficulty(currentBoard) }));
            return false;
        }
        return true;
    }

    function resetInteractionState() {
        conflictCells = new Set();
        selectedCell = null;
        visualSteps = [];
        animationRunId++;
        clearAlgorithmPanel();
        updateGridDisplay({ animateSolved: false });
    }

    function validateBoard(board) {
        const conflicts = new Set();
        let reason = '';

        const checkGroup = (positions, label) => {
            const seen = new Map();
            positions.forEach(([r, c]) => {
                const val = board[r][c];
                if (val === 0) return;
                if (!seen.has(val)) {
                    seen.set(val, []);
                }
                seen.get(val).push([r, c]);
            });

            for (const [val, cells] of seen.entries()) {
                if (cells.length > 1) {
                    cells.forEach(([r, c]) => conflicts.add(cellKey(r, c)));
                    if (!reason) reason = `Duplicate number ${val} in ${label}`;
                }
            }
        };

        for (let r = 0; r < 9; r++) {
            checkGroup(Array.from({ length: 9 }, (_, c) => [r, c]), `row ${r + 1}`);
        }
        for (let c = 0; c < 9; c++) {
            checkGroup(Array.from({ length: 9 }, (_, r) => [r, c]), `column ${c + 1}`);
        }
        for (let boxR = 0; boxR < 3; boxR++) {
            for (let boxC = 0; boxC < 3; boxC++) {
                const positions = [];
                for (let r = 0; r < 3; r++) {
                    for (let c = 0; c < 3; c++) {
                        positions.push([boxR * 3 + r, boxC * 3 + c]);
                    }
                }
                checkGroup(positions, `3x3 grid ${boxR + 1},${boxC + 1}`);
            }
        }

        return {
            valid: conflicts.size === 0,
            conflicts,
            reason: reason || 'Grid is currently valid'
        };
    }

    function solveWithTrace(board, depth) {
        visualStats.recursiveCalls++;
        const empty = findBestEmptyCell(board);
        if (!empty) {
            addStep('solved', null, 0, depth, 'Solved', 'All cells are filled. The board is solved.');
            return true;
        }

        const [row, col, candidates] = empty;
        for (const num of candidates) {
            visualStats.steps++;
            addStep('try', [row, col], num, depth, `Trying number ${num} at row ${row + 1}, col ${col + 1}`, 'The algorithm tests the next candidate value.');

            if (isSafe(board, row, col, num)) {
                board[row][col] = num;
                addStep('valid', [row, col], num, depth, `Valid move: ${num} fits at row ${row + 1}, col ${col + 1}`, 'Move accepted. Recursion continues to the next empty cell.');
                if (solveWithTrace(board, depth + 1)) return true;

                board[row][col] = 0;
                visualStats.backtracks++;
                addStep('backtrack', [row, col], 0, depth, `Backtracking from row ${row + 1}, col ${col + 1}`, 'No later value worked, so this cell is cleared and another candidate is tried.');
            } else {
                addStep('invalid', [row, col], num, depth, `Conflict found for ${num} at row ${row + 1}, col ${col + 1}`, 'Candidate breaks row, column, or 3x3 grid rules.');
            }
        }
        return false;
    }

    function findBestEmptyCell(board) {
        let best = null;
        let bestCandidates = null;

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] !== 0) continue;

                const candidates = [];
                for (let num = 1; num <= 9; num++) {
                    visualStats.steps++;
                    if (isSafe(board, r, c, num)) {
                        candidates.push(num);
                    } else {
                        addStep('invalid', [r, c], num, bestCandidates ? bestCandidates.length : 0, `Conflict found for ${num} at row ${r + 1}, col ${c + 1}`, 'Candidate breaks row, column, or 3x3 grid rules.');
                    }
                }

                if (candidates.length === 0) {
                    return [r, c, []];
                }
                if (!bestCandidates || candidates.length < bestCandidates.length) {
                    best = [r, c];
                    bestCandidates = candidates;
                    if (candidates.length === 1) return [r, c, candidates];
                }
            }
        }
        return best ? [best[0], best[1], bestCandidates] : null;
    }

    function isSafe(board, row, col, num) {
        for (let i = 0; i < 9; i++) {
            if (board[row][i] === num || board[i][col] === num) return false;
        }
        const startRow = row - (row % 3);
        const startCol = col - (col % 3);
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                if (board[startRow + r][startCol + c] === num) return false;
            }
        }
        return true;
    }

    function addStep(type, cell, value, depth, title, detail) {
        visualSteps.push({ type, cell, value, depth, title, detail });
    }

    async function playVisualSteps(runId) {
        const total = visualSteps.length;
        for (let i = 0; i < total; i++) {
            if (runId !== animationRunId) return;
            const step = visualSteps[i];
            applyVisualStep(step, i + 1, total);
            updateStats({ ...visualStats, time: visualStats.time, status: step.type === 'solved' ? 'Solved' : 'Solving' });
            await sleep(getVisualDelay());
        }
        setStatus('Solved Successfully', 'success');
        updateStats({ ...visualStats, status: 'Solved' });
    }

    function applyVisualStep(step, index, total) {
        stepCounter.textContent = `Step ${index} / ${total}`;
        stepProgress.style.width = `${Math.round((index / total) * 100)}%`;
        algorithmCurrent.textContent = `${step.title}. ${step.detail}`;
        renderRecursionTree(step.depth);
        pushAlgorithmLog(`STEP ${index}`, step.title, step.type);

        getCells().forEach(cell => cell.classList.remove('trying', 'backtracking'));
        if (step.cell) {
            const [r, c] = step.cell;
            const cell = getCell(r, c);
            if (step.type === 'try' || step.type === 'valid') {
                currentBoard[r][c] = step.value;
                if (cell) cell.classList.add('trying');
            }
            if (step.type === 'invalid') {
                currentBoard[r][c] = 0;
                if (cell) cell.classList.add('conflict');
            }
            if (step.type === 'backtrack') {
                currentBoard[r][c] = 0;
                if (cell) cell.classList.add('backtracking');
            }
            updateGridDisplay({ animateSolved: step.type === 'valid' });
            const updatedCell = getCell(r, c);
            if (updatedCell) {
                updatedCell.classList.add(step.type === 'backtrack' ? 'backtracking' : step.type === 'invalid' ? 'conflict' : 'trying');
            }
        }
    }

    function pushAlgorithmLog(label, message, type) {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `${label}: ${message}`;
        algorithmLog.prepend(entry);
        while (algorithmLog.children.length > 42) {
            algorithmLog.removeChild(algorithmLog.lastChild);
        }
    }

    function renderRecursionTree(depth) {
        recursionTree.innerHTML = '';
        const nodes = Math.min(depth + 1, 32);
        for (let i = 0; i < nodes; i++) {
            const node = document.createElement('div');
            node.className = 'depth-node';
            node.style.height = `${8 + Math.min(i, 18) * 1.7}px`;
            recursionTree.appendChild(node);
        }
    }

    function clearAlgorithmPanel() {
        algorithmCurrent.textContent = 'Select Visual Solve to watch each recursive decision.';
        algorithmLog.innerHTML = '';
        recursionTree.innerHTML = '';
        stepCounter.textContent = 'Step 0 / 0';
        stepProgress.style.width = '0%';
    }

    function updateStats(stats) {
        setStat(statAlgorithm, stats.algorithm || 'Backtracking');
        setStat(statTime, `${Number(stats.time || 0).toFixed(3)} sec`);
        setStat(statSteps, String(stats.steps ?? stats.recursiveCalls ?? 0));
        setStat(statBacktracks, String(stats.backtracks ?? 0));
        setStat(statDifficulty, stats.difficulty || estimateDifficulty(currentBoard));
        setStat(statStatus, stats.status || 'Ready');
    }

    function setStat(element, value) {
        if (element.textContent === value) return;
        element.textContent = value;
        element.classList.add('changed');
        setTimeout(() => element.classList.remove('changed'), 300);
    }

    function estimateDifficulty(board) {
        const filled = board.flat().filter(Boolean).length;
        if (filled === 0) return 'Empty';
        if (filled >= 38) return 'Easy';
        if (filled >= 28) return 'Medium';
        if (filled >= 20) return 'Hard';
        return 'Expert';
    }

    function updateSpeedLabel() {
        const value = Number(speedSlider.value);
        if (value < 34) speedLabel.textContent = 'Slow';
        else if (value < 72) speedLabel.textContent = 'Balanced';
        else speedLabel.textContent = 'Fast';
    }

    function getVisualDelay() {
        const speed = Number(speedSlider.value);
        return Math.round(260 - speed * 2.5);
    }

    function cellKey(r, c) {
        return `${r}-${c}`;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, Math.max(18, ms)));
    }

    initGrid();
});
