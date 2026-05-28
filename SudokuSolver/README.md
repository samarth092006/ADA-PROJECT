# Automated Sudoku Solver using Backtracking in C

An advanced, high-performance web application that solves any valid Sudoku puzzle using a C-based Backtracking algorithm, bridged seamlessly with a Python Flask REST API, and presented via a premium dark-themed, glassmorphic HTML/CSS/JS frontend.

---

## 🌟 Architecture & Data Flow

This application is built with a decoupled three-tier architecture:

```
HTML/CSS/JS Frontend
         │
         │ (HTTP POST /solve with JSON matrix)
         ▼
 Python Flask REST API
         │
         │ (Subprocess spawn, writes 81 integers to Stdin)
         ▼
  C Backtracking Solver (Compiled Binary)
         │
         │ (Solves using recursion & outputs solved JSON to Stdout)
         ▼
 Python Flask REST API
         │
         │ (Returns HTTP 200 with JSON solution)
         ▼
HTML/CSS/JS Frontend (Animates & updates grid)
```

---

## 📁 Project Structure

```text
SudokuSolver/
│── frontend/
│   │── index.html          # Structural UI & virtual keypad layout
│   │── style.css           # Premium glassmorphic dark-theme styles & animations
│   │── script.js           # Interactive grid logic & async API integration
│
│── backend/
│   │── sudoku_solver.c     # High-speed C Sudoku backtracking solver
│   │── app.py              # Flask server serving files & executing C binary
│
│── requirements.txt        # Python dependency requirements
└── README.md               # Setup, compilation, and Viva-ready guide
```

---

## 🛠️ Windows Setup & Installation Guide

Follow these step-by-step instructions to set up, compile, and run the project on Windows:

### Step 1: Install Python
1. Download Python 3.10+ from the [official website](https://www.python.org/downloads/).
2. **CRITICAL**: During installation, check the box that says **"Add Python to PATH"**.
3. Verify your installation by opening a terminal (Command Prompt or PowerShell) and typing:
   ```bash
   python --version
   ```

### Step 2: Install Python Dependencies
1. Navigate to the root directory of the project:
   ```bash
   cd c:\Users\samar\OneDrive\Desktop\ADA\SudokuSolver
   ```
2. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

### Step 3: Install GCC Compiler (MinGW-w64)
Since this project uses a C backend for high-performance solving, a C compiler must be available in your PATH.
1. The easiest way to install GCC on Windows is using **winget**:
   ```powershell
   winget install MSYS2.MSYS2
   ```
2. Once installed, open MSYS2 UCRT64 and run:
   ```bash
   pacman -S mingw-w64-ucrt-x86_64-gcc
   ```
3. Add the binary path (typically `C:\msys64\ucrt64\bin`) to your Windows User/System **Environment Variables (PATH)**.
4. Verify by opening a new Command Prompt or PowerShell and running:
   ```bash
   gcc --version
   ```

---

## ⚙️ Compilation & Running Instructions

### 1. Compile the C Solver
To compile the C source code into a high-performance executable file, navigate to the root directory and run the compilation command:

**On Windows:**
```powershell
gcc -O3 -o backend/sudoku_solver.exe backend/sudoku_solver.c
```

**On macOS / Linux:**
```bash
gcc -O3 -o backend/sudoku_solver backend/sudoku_solver.c
```
*(The `-O3` flag enables aggressive compiler optimizations, giving the backtracking recursion peak performance.)*

### 2. Run the Flask Web Application
Once compiled, start the Python API bridge server:
```bash
python backend/app.py
```

### 3. Open in Browser
Open your web browser and navigate to:
```text
http://127.0.0.1:5000
```
Click **"Load Sample"**, then click **"Solve"** to watch the solver instantly process and solve the puzzle!

---

## 💻 VS Code Workspace Integration

To make development and compilation seamless, you can configure standard VS Code build tasks.

### Build Task (`.vscode/tasks.json`)
Create a folder named `.vscode` in the root, and add a file named `tasks.json` with the following configuration:
```json
{
    "version": "2.0.0",
    "tasks": [
        {
            "type": "shell",
            "label": "Compile C Sudoku Solver",
            "command": "gcc",
            "args": [
                "-O3",
                "-o",
                "${workspaceFolder}/backend/sudoku_solver.exe",
                "${workspaceFolder}/backend/sudoku_solver.c"
            ],
            "group": {
                "kind": "build",
                "isDefault": true
            },
            "problemMatcher": ["$gcc"]
        }
    ]
}
```
*You can now press `Ctrl+Shift+B` inside VS Code to instantly recompile the C solver at any time!*

---

## 🎓 Viva Q&A & Technical Explanation

Be fully prepared for final-year project reviews and viva presentations with these standard technical breakdowns:

### 1. What is Backtracking and how is it used here?
**Backtracking** is a systematic algorithmic technique for solving combinatorial problems by trying to build a solution incrementally, one piece at a time, removing those solutions that fail to satisfy the constraints of the problem at any point.

In our C solver:
1. **Find an Empty Cell**: We search the 9x9 grid for an empty cell (`0`) using `findEmptyCell()`.
2. **Assign Values (1 to 9)**: We attempt to place a number between `1` and `9` into that cell.
3. **Constraint Validation**: Before placement, `isValid()` verifies if the number complies with three rules:
   - Unique in its **Row**.
   - Unique in its **Column**.
   - Unique in its **3x3 Subgrid**.
4. **Recursion**: If valid, we assign the number and call `solveSudoku()` recursively to solve the next empty cell.
5. **Backtrack**: If a subsequent step fails to find any valid path, we reset the current cell to `0` (backtrack) and try the next number (e.g. changing `5` to `6`).

### 2. What is the Complexity Analysis of the Solver?
- **Time Complexity**: $O(9^m)$ where $m$ is the number of empty cells on the board. In the absolute worst-case (an empty board), the algorithm may visit states, though constraint validation trims the search space exponentially (practical time is under 1 millisecond).
- **Space Complexity**: $O(m)$ auxiliary stack frame space due to the depth of the recursive call stack. In a 9x9 grid, the maximum call stack depth is 81 frames, which consumes minimal memory (bytes).

### 3. Why did you use C for solving and Python for the API?
- **High Performance**: C is a statically typed, compiled language with zero run-time overhead. Backtracking requires highly nested recursive call loops. C executes these operations directly on the CPU register level, making it hundreds of times faster than interpreted languages.
- **Modern Connectivity**: C does not natively support web servers, HTTP requests, or JSON formatting easily. Python's **Flask** handles JSON decoding, serves the static HTML/CSS/JS frontend files, and exposes clean REST endpoints, creating the perfect division of labor.

### 4. How does the Flask server communicate with the C Solver executable?
The communication is handled using Python's native `subprocess` module:
1. Flask formats the incoming 9x9 JSON matrix into a space-separated string of 81 numbers.
2. It launches a background process of `sudoku_solver.exe`.
3. It pipes the formatted string directly to the program's **Standard Input (Stdin)**.
4. The C program processes it, solves it, and writes the resulting 9x9 matrix formatted as a JSON string to its **Standard Output (Stdout)**.
5. Flask catches the stdout stream, parses the JSON string, and returns it as the API response.
