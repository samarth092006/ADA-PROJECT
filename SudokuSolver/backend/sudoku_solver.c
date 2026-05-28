#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>

// Function Declarations
bool findEmptyCell(int board[9][9], int *row, int *col);
bool isValid(int board[9][9], int row, int col, int num);
bool solveSudoku(int board[9][9]);
bool isInitialConfigValid(int board[9][9]);
void printJSONResponse(int board[9][9], bool success);

int main() {
    int board[9][9];

    // Read 81 integers from standard input
    for (int i = 0; i < 9; i++) {
        for (int j = 0; j < 9; j++) {
            if (scanf("%d", &board[i][j]) != 1) {
                printf("{\n  \"error\": \"Failed to read 9x9 board from input.\"\n}\n");
                return 1;
            }
            // Check input boundaries
            if (board[i][j] < 0 || board[i][j] > 9) {
                printf("{\n  \"error\": \"Invalid cell value. Numbers must be between 0 and 9.\"\n}\n");
                return 1;
            }
        }
    }

    // Check if the initial board is valid (no initial duplicates)
    if (!isInitialConfigValid(board)) {
        printJSONResponse(board, false);
        return 0;
    }

    // Solve Sudoku
    bool success = solveSudoku(board);

    // Print JSON output
    printJSONResponse(board, success);

    return 0;
}

// Check if there is an empty cell (value == 0) in the grid
bool findEmptyCell(int board[9][9], int *row, int *col) {
    for (int r = 0; r < 9; r++) {
        for (int c = 0; c < 9; c++) {
            if (board[r][c] == 0) {
                *row = r;
                *col = c;
                return true;
            }
        }
    }
    return false;
}

// Check if it's safe to assign a number to the given cell
bool isValid(int board[9][9], int row, int col, int num) {
    // Check row
    for (int c = 0; c < 9; c++) {
        if (board[row][c] == num) {
            return false;
        }
    }

    // Check column
    for (int r = 0; r < 9; r++) {
        if (board[r][col] == num) {
            return false;
        }
    }

    // Check 3x3 subgrid
    int startRow = row - row % 3;
    int startCol = col - col % 3;
    for (int r = 0; r < 3; r++) {
        for (int c = 0; c < 3; c++) {
            if (board[r + startRow][c + startCol] == num) {
                return false;
            }
        }
    }

    return true;
}

// Backtracking solver
bool solveSudoku(int board[9][9]) {
    int row, col;

    // If there is no empty cell, the Sudoku is solved!
    if (!findEmptyCell(board, &row, &col)) {
        return true;
    }

    // Try digits 1 to 9
    for (int num = 1; num <= 9; num++) {
        if (isValid(board, row, col, num)) {
            // Tentatively assign number
            board[row][col] = num;

            // Recur to solve rest of the grid
            if (solveSudoku(board)) {
                return true;
            }

            // Backtrack if assignment doesn't lead to a solution
            board[row][col] = 0;
        }
    }

    return false; // Triggers backtracking
}

// Check initial configuration validity
bool isInitialConfigValid(int board[9][9]) {
    for (int r = 0; r < 9; r++) {
        for (int c = 0; c < 9; c++) {
            int val = board[r][c];
            if (val != 0) {
                board[r][c] = 0; // Temporarily clear to avoid checking self
                if (!isValid(board, r, c, val)) {
                    board[r][c] = val; // Restore before returning
                    return false;
                }
                board[r][c] = val; // Restore
            }
        }
    }
    return true;
}

// Output final result as JSON
void printJSONResponse(int board[9][9], bool success) {
    if (success) {
        printf("{\n  \"solvedBoard\": [\n");
        for (int i = 0; i < 9; i++) {
            printf("    [");
            for (int j = 0; j < 9; j++) {
                printf("%d", board[i][j]);
                if (j < 8) {
                    printf(", ");
                }
            }
            printf("]%s\n", (i < 8) ? "," : "");
        }
        printf("  ]\n}\n");
    } else {
        printf("{\n  \"error\": \"Unsolvable board\"\n}\n");
    }
}
