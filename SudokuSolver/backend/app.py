import os
import subprocess
import sys
import time
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# Determine the absolute paths for frontend and backend
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
BACKEND_DIR = os.path.join(BASE_DIR, "backend")

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
CORS(app)  # Enable Cross-Origin Resource Sharing

# Paths to the C solver executable
EXE_NAME = "sudoku_solver.exe" if sys.platform.startswith("win") else "sudoku_solver"
EXE_PATH = os.path.join(BACKEND_DIR, EXE_NAME)

@app.route("/")
def index():
    """Serves the main frontend page."""
    return send_from_directory(FRONTEND_DIR, "index.html")

def find_empty_cell(board):
    for r in range(9):
        for c in range(9):
            if board[r][c] == 0:
                return r, c
    return None

def is_valid(board, row, col, num):
    for c in range(9):
        if board[row][c] == num:
            return False
    for r in range(9):
        if board[r][col] == num:
            return False
    start_row = row - row % 3
    start_col = col - col % 3
    for r in range(3):
        for c in range(3):
            if board[r + start_row][c + start_col] == num:
                return False
    return True

def estimate_difficulty(board):
    filled = sum(1 for row in board for val in row if val != 0)
    if filled == 0:
        return "Empty"
    if filled >= 38:
        return "Easy"
    if filled >= 28:
        return "Medium"
    if filled >= 20:
        return "Hard"
    return "Expert"

def validate_board(board):
    for r in range(9):
        row_vals = [v for v in board[r] if v != 0]
        if len(row_vals) != len(set(row_vals)):
            return False, f"Duplicate number in row {r + 1}"

    for c in range(9):
        col_vals = [board[r][c] for r in range(9) if board[r][c] != 0]
        if len(col_vals) != len(set(col_vals)):
            return False, f"Duplicate number in column {c + 1}"

    for box_r in range(3):
        for box_c in range(3):
            box_vals = []
            for r in range(3):
                for c in range(3):
                    val = board[box_r * 3 + r][box_c * 3 + c]
                    if val != 0:
                        box_vals.append(val)
            if len(box_vals) != len(set(box_vals)):
                return False, f"Duplicate number in 3x3 grid {box_r + 1},{box_c + 1}"

    return True, "Grid is currently valid"

def solve_sudoku_py(board, stats=None):
    if stats is not None:
        stats["recursiveCalls"] += 1

    empty = find_empty_cell(board)
    if not empty:
        return True
    row, col = empty
    for num in range(1, 10):
        if stats is not None:
            stats["steps"] += 1
        if is_valid(board, row, col, num):
            board[row][col] = num
            if solve_sudoku_py(board, stats):
                return True
            board[row][col] = 0
            if stats is not None:
                stats["backtracks"] += 1
    return False

@app.route("/solve", methods=["POST"])
def solve():
    """
    API endpoint to solve Sudoku.
    Expects JSON payload: { "board": [[... 9x9 ...]] }
    Sends board to C executable and returns solved board JSON.
    """
    data = request.get_json()
    if not data or "board" not in data:
        return jsonify({"error": "Invalid payload. 'board' is required."}), 400

    board = data["board"]

    # Validate structure: must be 9x9 grid of integers 0-9
    if not isinstance(board, list) or len(board) != 9:
        return jsonify({"error": "Board must be a 9x9 grid."}), 400
    
    flat_board = []
    for r_idx, row in enumerate(board):
        if not isinstance(row, list) or len(row) != 9:
            return jsonify({"error": f"Row {r_idx + 1} must contain exactly 9 values."}), 400
        for c_idx, val in enumerate(row):
            if not isinstance(val, int) or val < 0 or val > 9:
                return jsonify({"error": f"Cell at ({r_idx + 1}, {c_idx + 1}) must be an integer between 0 and 9."}), 400
            flat_board.append(str(val))

    board_valid, reason = validate_board(board)
    if not board_valid:
        return jsonify({"error": "Unsolvable board", "details": reason}), 200

    start_time = time.perf_counter()
    difficulty = estimate_difficulty(board)

    # Check if the C executable exists; if not, use the Python solver fallback
    if not os.path.exists(EXE_PATH):
        print("WARNING: C Solver executable not found. Running internal Python Solver Fallback...")
        stats = {"steps": 0, "backtracks": 0, "recursiveCalls": 0}
        solved_board = [row[:] for row in board]
        if solve_sudoku_py(solved_board, stats):
            stats.update({
                "algorithm": "Backtracking",
                "time": round(time.perf_counter() - start_time, 6),
                "difficulty": difficulty,
                "status": "Solved"
            })
            return jsonify({"solvedBoard": solved_board, "stats": stats})
        else:
            return jsonify({"error": "Unsolvable board", "stats": {
                "algorithm": "Backtracking",
                "time": round(time.perf_counter() - start_time, 6),
                "difficulty": difficulty,
                "status": "Unsolvable",
                **stats
            }}), 200

    try:
        # Format grid data as a space-separated string for the C program
        input_data = " ".join(flat_board)

        # Run the C executable
        process = subprocess.Popen(
            [EXE_PATH],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        # Pass board input and wait for completion
        stdout, stderr = process.communicate(input=input_data, timeout=5)

        if process.returncode != 0:
            return jsonify({
                "error": "C solver crashed or exited with an error.",
                "details": stderr.strip()
            }), 500

        # Parse JSON from C program's stdout
        import json
        try:
            result = json.loads(stdout)
            result["stats"] = {
                "algorithm": "Backtracking",
                "time": round(time.perf_counter() - start_time, 6),
                "steps": 0,
                "backtracks": 0,
                "recursiveCalls": 0,
                "difficulty": difficulty,
                "status": "Solved" if "solvedBoard" in result else "Unsolvable"
            }
            return jsonify(result)
        except json.JSONDecodeError:
            return jsonify({
                "error": "Failed to parse C program output as JSON.",
                "raw_output": stdout
            }), 500

    except subprocess.TimeoutExpired:
        process.kill()
        return jsonify({"error": "Solver timed out (maximum 5 seconds allowed)."}), 504
    except Exception as e:
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

@app.route("/validate", methods=["POST"])
def validate():
    """
    Validates whether the current grid entries contain any conflicts (duplicate in row, column, or 3x3 grid).
    """
    data = request.get_json()
    if not data or "board" not in data:
        return jsonify({"error": "Invalid payload. 'board' is required."}), 400

    board = data["board"]

    # Inline quick validation
    # Row validation
    for r in range(9):
        seen = set()
        for c in range(9):
            val = board[r][c]
            if val != 0:
                if val in seen:
                    return jsonify({"valid": False, "reason": f"Duplicate value {val} in Row {r + 1}."})
                seen.add(val)

    # Column validation
    for c in range(9):
        seen = set()
        for r in range(9):
            val = board[r][c]
            if val != 0:
                if val in seen:
                    return jsonify({"valid": False, "reason": f"Duplicate value {val} in Column {c + 1}."})
                seen.add(val)

    # 3x3 Grid validation
    for box_row in range(3):
        for box_col in range(3):
            seen = set()
            for r in range(3):
                for c in range(3):
                    val = board[box_row * 3 + r][box_col * 3 + c]
                    if val != 0:
                        if val in seen:
                            return jsonify({"valid": False, "reason": f"Duplicate value {val} in 3x3 Subgrid starting at cell ({box_row * 3 + 1}, {box_col * 3 + 1})."})
                        seen.add(val)

    return jsonify({"valid": True, "reason": "Grid is currently valid (no conflicts detected)."})

if __name__ == "__main__":
    print(f"Starting Sudoku Solver API Bridge...")
    print(f"Static Files served from: {FRONTEND_DIR}")
    print(f"C Solver executable location: {EXE_PATH}")
    app.run(host="127.0.0.1", port=5000, debug=True)
