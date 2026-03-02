/* ========================================
   Canvas Renderer — Clean Preview & Blueprint Mode
   V4: Dynamic margins, robust numbering, major grid blocks
   ======================================== */

import { getContrastColor } from '../utils/colorUtils.js';

/** @type {'clean'|'blueprint'} */
let currentView = 'clean';
let currentGrid = null;
let currentCellSize = 12;
let currentZoom = 1;
let highlightedCode = null;
let gridBlockSize = 10;

let canvasEl = null;
let ctx = null;

/**
 * Calculate dynamic margin based on the max number and cell size
 */
function calcMargin(maxNum, cell) {
    // Estimate width of the largest number
    const digits = String(maxNum).length;
    // Base: enough for digits + padding; scale with cell size but set min/max
    const charWidth = Math.max(5, Math.min(cell * 0.4, 8));
    return Math.max(20, Math.round(digits * charWidth + 10));
}

export function initRenderer(canvas) {
    canvasEl = canvas;
    ctx = canvas.getContext('2d');
}

export function setGridBlockSize(size) {
    gridBlockSize = Math.max(2, Math.min(30, size));
    if (currentGrid) renderGrid(currentGrid);
}

export function getGridBlockSize() {
    return gridBlockSize;
}

/**
 * Render the bead grid on canvas.
 * In blueprint mode: adds margins for row/col numbers, major grid blocks, Excel labels.
 */
export function renderGrid(result, view = currentView, zoom = currentZoom, highlight = highlightedCode) {
    if (!canvasEl || !ctx || !result) return;

    currentGrid = result;
    currentView = view;
    currentZoom = zoom;
    highlightedCode = highlight;

    const { grid, width, height } = result;

    const baseCell = view === 'blueprint' ? 28 : 12;
    const cell = Math.max(4, Math.round(baseCell * zoom));
    currentCellSize = cell;

    const isBP = view === 'blueprint';
    const margin = isBP ? calcMargin(Math.max(width, height), cell) : 0;

    const canvasW = width * cell + margin * 2;
    const canvasH = height * cell + margin * 2;
    canvasEl.width = canvasW;
    canvasEl.height = canvasH;

    ctx.clearRect(0, 0, canvasW, canvasH);

    // Margin background
    if (isBP) {
        ctx.fillStyle = '#FAF6F1';
        ctx.fillRect(0, 0, canvasW, canvasH);
    }

    // Draw beads
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const bead = grid[y][x];
            const px = margin + x * cell;
            const py = margin + y * cell;
            const isDimmed = highlight && bead.code !== highlight;

            ctx.fillStyle = bead.hex;
            if (isDimmed) ctx.globalAlpha = 0.25;

            if (view === 'clean') {
                const gap = cell > 8 ? 0.5 : 0;
                const r = cell > 10 ? 1.5 : 0;
                if (r > 0) {
                    roundRect(ctx, px + gap, py + gap, cell - gap * 2, cell - gap * 2, r);
                    ctx.fill();
                } else {
                    ctx.fillRect(px + gap, py + gap, cell - gap * 2, cell - gap * 2);
                }
            } else {
                ctx.fillRect(px, py, cell, cell);
            }
            ctx.globalAlpha = 1;
        }
    }

    if (isBP) {
        drawGridLines(ctx, width, height, cell, margin);
        drawMajorGridBlocks(ctx, width, height, cell, margin);
        drawRowColNumbers(ctx, width, height, cell, margin);
        if (cell >= 18) drawColorCodes(ctx, grid, width, height, cell, margin);
    }
}

/**
 * Render blueprint features onto an EXTERNAL canvas context (for fullscreen modal).
 * Call this from main.js after drawing beads on the modal canvas.
 */
export function renderBlueprintOverlay(extCtx, grid, width, height, cell, margin) {
    drawGridLines(extCtx, width, height, cell, margin);
    drawMajorGridBlocks(extCtx, width, height, cell, margin);
    drawRowColNumbers(extCtx, width, height, cell, margin);
    if (cell >= 18) drawColorCodes(extCtx, grid, width, height, cell, margin);
}

/**
 * Get the calculated margin for the current grid
 */
export function getCurrentMargin() {
    if (!currentGrid) return 0;
    if (currentView !== 'blueprint') return 0;
    const baseCell = currentView === 'blueprint' ? 28 : 12;
    const cell = Math.max(4, Math.round(baseCell * currentZoom));
    return calcMargin(Math.max(currentGrid.width, currentGrid.height), cell);
}

// ==================== DRAWING FUNCTIONS ====================

function drawGridLines(c, w, h, cell, margin) {
    c.strokeStyle = 'rgba(0, 0, 0, 0.10)';
    c.lineWidth = 0.5;
    c.beginPath();
    for (let x = 0; x <= w; x++) {
        const px = margin + x * cell;
        c.moveTo(px, margin); c.lineTo(px, margin + h * cell);
    }
    for (let y = 0; y <= h; y++) {
        const py = margin + y * cell;
        c.moveTo(margin, py); c.lineTo(margin + w * cell, py);
    }
    c.stroke();
}

function drawMajorGridBlocks(c, w, h, cell, margin) {
    const bs = gridBlockSize;

    // Thick block lines
    c.strokeStyle = 'rgba(210, 120, 60, 0.45)';
    c.lineWidth = Math.max(1, cell > 15 ? 1.5 : 1);
    c.beginPath();
    for (let x = 0; x <= w; x += bs) {
        const px = margin + x * cell;
        c.moveTo(px, margin); c.lineTo(px, margin + h * cell);
    }
    for (let y = 0; y <= h; y += bs) {
        const py = margin + y * cell;
        c.moveTo(margin, py); c.lineTo(margin + w * cell, py);
    }
    c.stroke();

    // Excel-style block labels
    if (cell * bs >= 40) {
        const blockFont = Math.max(7, Math.min(cell * bs * 0.06, 11));
        c.font = `600 ${blockFont}px 'JetBrains Mono', monospace`;
        c.textAlign = 'left';
        c.textBaseline = 'top';
        c.fillStyle = 'rgba(210, 120, 60, 0.55)';

        const colBlocks = Math.ceil(w / bs);
        const rowBlocks = Math.ceil(h / bs);

        for (let br = 0; br < rowBlocks; br++) {
            for (let bc = 0; bc < colBlocks; bc++) {
                const label = getBlockLabel(bc) + (br + 1);
                const bx = margin + bc * bs * cell + 3;
                const by = margin + br * bs * cell + 2;
                c.fillText(label, bx, by);
            }
        }
    }
}

function getBlockLabel(index) {
    let label = '';
    let n = index;
    do {
        label = String.fromCharCode(65 + (n % 26)) + label;
        n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return label;
}

function drawRowColNumbers(c, w, h, cell, margin) {
    // Dynamic font size: scales with cell but capped to stay readable
    const fontSize = Math.max(6, Math.min(cell * 0.42, margin * 0.55, 11));
    c.font = `500 ${fontSize}px 'JetBrains Mono', monospace`;
    c.fillStyle = '#8a857e';

    // Top & bottom column numbers
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (let x = 0; x < w; x++) {
        const px = margin + x * cell + cell / 2;
        const num = String(x + 1);
        c.fillText(num, px, margin / 2);                    // top
        c.fillText(num, px, margin + h * cell + margin / 2); // bottom
    }

    // Left & right row numbers
    for (let y = 0; y < h; y++) {
        const py = margin + y * cell + cell / 2;
        const num = String(y + 1);
        c.fillText(num, margin / 2, py);                    // left
        c.fillText(num, margin + w * cell + margin / 2, py); // right
    }
}

function drawColorCodes(c, grid, w, h, cell, margin) {
    const fontSize = Math.max(7, Math.min(cell * 0.32, 14));
    c.font = `500 ${fontSize}px 'JetBrains Mono', monospace`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const bead = grid[y][x];
            const px = margin + x * cell + cell / 2;
            const py = margin + y * cell + cell / 2;
            const textW = c.measureText(bead.code).width;

            c.fillStyle = 'rgba(255, 255, 255, 0.6)';
            c.fillRect(px - textW / 2 - 2, py - fontSize / 2 - 1, textW + 4, fontSize + 2);

            c.fillStyle = getContrastColor(bead.r, bead.g, bead.b);
            c.globalAlpha = 0.85;
            c.fillText(bead.code, px, py);
            c.globalAlpha = 1;
        }
    }
}

function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
}

// ==================== EXPORTS ====================

export function setView(view) {
    currentView = view;
    if (currentGrid) renderGrid(currentGrid);
}

export function setZoom(zoom) {
    currentZoom = Math.max(0.3, Math.min(3, zoom));
    if (currentGrid) renderGrid(currentGrid);
    return currentZoom;
}

export function highlightColor(code) {
    highlightedCode = code;
    if (currentGrid) renderGrid(currentGrid);
}

export function clearHighlight() {
    highlightedCode = null;
    if (currentGrid) renderGrid(currentGrid);
}

export function getCanvasDataURL(format = 'image/png') {
    if (!canvasEl) return null;
    return canvasEl.toDataURL(format);
}

export function getCanvasDimensions() {
    return { width: canvasEl?.width || 0, height: canvasEl?.height || 0 };
}

export function calcFitZoom(containerW, containerH) {
    if (!currentGrid) return 1;
    const { width, height } = currentGrid;
    const baseCell = currentView === 'blueprint' ? 28 : 12;
    // Account for margin in blueprint mode
    const maxNum = Math.max(width, height);
    const testCell = Math.max(4, Math.round(baseCell * 1));
    const margin = currentView === 'blueprint' ? calcMargin(maxNum, testCell) : 0;
    const idealW = (containerW - margin * 2) / (width * baseCell);
    const idealH = (containerH - margin * 2) / (height * baseCell);
    return Math.min(idealW, idealH, 3);
}

// Export helpers for the modal renderer
export { calcMargin, getBlockLabel };
