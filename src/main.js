/* ========================================
   BeadCraft Studio — Main Application Entry V2
   ======================================== */

import './styles/index.css';
import './styles/components.css';

import { loadColorCard, findNearestColor } from './modules/colorCard.js';
import { loadImageFile, processImage } from './modules/imageProcessor.js';
import { initRenderer, renderGrid, setView, setZoom, calcFitZoom, highlightColor, clearHighlight, setGridBlockSize, renderBlueprintOverlay, calcMargin } from './modules/canvasRenderer.js';
import { generateBOM, sortBOM } from './modules/bomGenerator.js';
import { exportPNG, exportPDF, exportAll } from './modules/exporter.js';
import { generatePixelArtRedraw, generatePixelArtCreate, getApiKey, setApiKey, hasApiKey } from './modules/geminiService.js';

// ==================== STATE ====================
let sourceImage = null;      // original uploaded image
let sourceFile = null;        // original file reference
let gridResult = null;
let bomData = null;
let sortBy = 'count';
let zoomLevel = 1;
let currentView = 'clean';
let currentMode = 'basic'; // 'basic' | 'redraw' | 'create'

// Board state
let boardW = 30;
let boardH = 30;

// Modal state
let modalZoom = 1;
let modalView = 'clean';
let modalRenderer = null;

// ==================== DOM REFS ====================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const uploadZone = $('#upload-zone');
const fileInput = $('#file-input');
const originalPreview = $('#original-preview');
const originalImg = $('#original-img');
const reUploadBtn = $('#re-upload-btn');
const controlPanel = $('#control-panel');
const workspace = $('#workspace');
const generateBtn = $('#generate-btn');
const boardWInput = $('#board-w');
const boardHInput = $('#board-h');
const boardActualSize = $('#board-actual-size');
const beadCanvas = $('#bead-canvas');
const canvasContainer = $('#canvas-container');
const bomList = $('#bom-list');
const bomTotalCount = $('#bom-total-count');
const bomColorCount = $('#bom-color-count');
const zoomLevelEl = $('#zoom-level');
const toast = $('#toast');
const toastText = $('#toast-text');
const dimsInfo = $('#dims-info');
const dimsActual = $('#dims-actual');
const dimsCanvas = $('#dims-canvas');
const dimsContent = $('#dims-content');

// Mode & AI elements
const modeHint = $('#mode-hint');
const aiLoading = $('#ai-loading');
const createSizeSlot = $('#create-size-slot');
const createWInput = $('#create-w');
const createHInput = $('#create-h');

// Modal elements
const previewModal = $('#preview-modal');
const modalCanvas = $('#modal-canvas');
const modalCanvasContainer = $('#modal-canvas-container');
const modalZoomLevel = $('#modal-zoom-level');

// Settings elements
const settingsModal = $('#settings-modal');
const apiKeyInput = $('#api-key-input');

// ==================== INIT ====================
async function init() {
    try {
        await loadColorCard();
        initRenderer(beadCanvas);
        bindEvents();
        updateBoardDisplay();

        // Load saved API key
        apiKeyInput.value = getApiKey();

        console.log('[BeadCraft] Studio V2 ready!');
    } catch (err) {
        console.error('[BeadCraft] Init failed:', err);
        showToast('色卡加载失败，请检查 CSV 文件');
    }
}

// ==================== EVENT BINDINGS ====================
function bindEvents() {
    // --- Upload ---
    uploadZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);

    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('drag-over');
    });
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) handleImage(file);
    });

    reUploadBtn.addEventListener('click', () => {
        fileInput.value = '';
        fileInput.click();
    });

    // --- Board Size Presets ---
    $$('.board-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.board-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const size = parseInt(btn.dataset.size);
            boardW = size;
            boardH = size;
            boardWInput.value = size;
            boardHInput.value = size;
            updateBoardDisplay();
        });
    });

    boardWInput.addEventListener('input', () => {
        $$('.board-btn').forEach(b => b.classList.remove('active'));
        boardW = parseInt(boardWInput.value) || 10;
        updateBoardDisplay();
    });

    boardHInput.addEventListener('input', () => {
        $$('.board-btn').forEach(b => b.classList.remove('active'));
        boardH = parseInt(boardHInput.value) || 10;
        updateBoardDisplay();
    });

    // --- Mode Selector (3-tier) ---
    $$('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = btn.dataset.mode;

            const hints = {
                basic: '快速像素化，直接缩放映射色卡',
                redraw: 'AI 保留原图构图与比例，优化为清晰像素画（需 API Key）',
                create: 'AI 提取内容，全新创作像素艺术，可自定义尺寸（需 API Key）'
            };
            modeHint.textContent = hints[currentMode];

            // Show/hide create size slot (CSS Grid 0fr/1fr)
            if (currentMode === 'create') {
                createSizeSlot.classList.add('open');
            } else {
                createSizeSlot.classList.remove('open');
            }

            if ((currentMode === 'redraw' || currentMode === 'create') && !hasApiKey()) {
                showToast('请先在设置中配置 Gemini API Key');
                openSettings();
            }
        });
    });

    // --- Generate ---
    generateBtn.addEventListener('click', handleGenerate);

    // --- View Toggle ---
    $$('.view-btn:not(.modal-view-btn)').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.view-btn:not(.modal-view-btn)').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentView = btn.dataset.view;
            setView(currentView);
        });
    });

    // --- Zoom (fixed container — canvas scrolls inside) ---
    $('#zoom-in').addEventListener('click', () => {
        zoomLevel = setZoom(zoomLevel + 0.25);
        updateZoomUI();
    });
    $('#zoom-out').addEventListener('click', () => {
        zoomLevel = setZoom(zoomLevel - 0.25);
        updateZoomUI();
    });
    $('#zoom-fit').addEventListener('click', fitCanvasZoom);

    // --- Grid Block Size ---
    $('#grid-block-select').addEventListener('change', (e) => {
        setGridBlockSize(parseInt(e.target.value));
    });

    canvasContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.15 : 0.15;
        zoomLevel = setZoom(zoomLevel + delta);
        updateZoomUI();
    }, { passive: false });

    // --- Fullscreen Preview ---
    $('#fullscreen-btn').addEventListener('click', openFullscreenPreview);
    $('#modal-close').addEventListener('click', closeFullscreenPreview);
    previewModal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeFullscreenPreview();
    });

    // Modal zoom
    $('#modal-zoom-in').addEventListener('click', () => {
        modalZoom = Math.min(5, modalZoom + 0.3);
        renderModalCanvas();
    });
    $('#modal-zoom-out').addEventListener('click', () => {
        modalZoom = Math.max(0.2, modalZoom - 0.3);
        renderModalCanvas();
    });
    $('#modal-zoom-fit').addEventListener('click', fitModalZoom);

    // Modal view toggle
    $$('.modal-view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.modal-view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            modalView = btn.dataset.view;
            renderModalCanvas();
        });
    });

    modalCanvasContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.15 : 0.15;
        modalZoom = Math.max(0.2, Math.min(5, modalZoom + delta));
        renderModalCanvas();
    }, { passive: false });

    // --- BOM Sort ---
    $$('.sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.sort-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            sortBy = btn.dataset.sort;
            if (bomData) renderBOM(bomData);
        });
    });

    // --- Export ---
    $('#export-png').addEventListener('click', () => {
        if (!gridResult) return;
        exportPNG(gridResult, currentView);
        showToast('图纸 PNG 已导出');
    });
    $('#export-pdf').addEventListener('click', () => {
        if (!gridResult || !bomData) return;
        exportPDF(gridResult, bomData);
        showToast('PDF 已导出');
    });
    $('#export-all').addEventListener('click', () => {
        if (!gridResult || !bomData) return;
        exportAll(gridResult, bomData);
        showToast('全部文件已导出');
    });

    // --- Settings ---
    $('#settings-btn').addEventListener('click', openSettings);
    $('#settings-close').addEventListener('click', closeSettings);
    $('.settings-modal__backdrop').addEventListener('click', closeSettings);
    $('#settings-save').addEventListener('click', saveSettings);
    $('#toggle-key-vis').addEventListener('click', () => {
        const inp = apiKeyInput;
        inp.type = inp.type === 'password' ? 'text' : 'password';
    });
}

// ==================== BOARD SIZE =====================
function updateBoardDisplay() {
    const actualW = boardW + 2; // +1 bleed each side
    const actualH = boardH + 2;
    boardActualSize.textContent = `${actualW}×${actualH}`;
}

function getCanvasDims() {
    // Canvas includes bleed: board size + 2
    return { w: boardW + 2, h: boardH + 2 };
}

// ==================== HANDLERS ====================
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) handleImage(file);
}

async function handleImage(file) {
    try {
        sourceFile = file;
        sourceImage = await loadImageFile(file);

        const reader = new FileReader();
        reader.onload = (e) => { originalImg.src = e.target.result; };
        reader.readAsDataURL(file);

        originalPreview.hidden = false;
        uploadZone.style.minHeight = '120px';
        controlPanel.hidden = false;

        showToast('图片已上传');
    } catch (err) {
        console.error('[BeadCraft] Image load failed:', err);
        showToast('图片加载失败');
    }
}

async function handleGenerate() {
    if (!sourceImage) return;

    generateBtn.disabled = true;
    generateBtn.innerHTML = `
        <svg class="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        生成中...
    `;

    try {
        let imageToProcess = sourceImage;
        let useRedrawPadding = false;
        let redrawFitW = boardW, redrawFitH = boardH;

        // ===== AI Modes =====
        if (currentMode === 'redraw' || currentMode === 'create') {
            if (!hasApiKey()) {
                showToast('请先配置 Gemini API Key');
                openSettings();
                resetGenerateBtn();
                return;
            }

            aiLoading.hidden = false;

            try {
                if (currentMode === 'redraw') {
                    // AI Redraw: calculate fit dimensions preserving original aspect ratio
                    const imgRatio = sourceImage.naturalWidth / sourceImage.naturalHeight;
                    if (imgRatio >= 1) {
                        redrawFitW = boardW;
                        redrawFitH = Math.round(boardW / imgRatio);
                        if (redrawFitH > boardH) { redrawFitH = boardH; redrawFitW = Math.round(boardH * imgRatio); }
                    } else {
                        redrawFitH = boardH;
                        redrawFitW = Math.round(boardH * imgRatio);
                        if (redrawFitW > boardW) { redrawFitW = boardW; redrawFitH = Math.round(boardW / imgRatio); }
                    }
                    redrawFitW = Math.max(5, redrawFitW);
                    redrawFitH = Math.max(5, redrawFitH);

                    imageToProcess = await generatePixelArtRedraw(sourceImage, redrawFitW, redrawFitH);
                    useRedrawPadding = true;
                } else {
                    // AI Create: use user-defined custom dimensions
                    const cW = parseInt(createWInput.value) || 30;
                    const cH = parseInt(createHInput.value) || 30;
                    imageToProcess = await generatePixelArtCreate(sourceImage, cW, cH);
                }
                showToast(currentMode === 'redraw' ? 'AI 重绘完成！' : 'AI 创作完成！');
            } catch (err) {
                console.error('[BeadCraft] Gemini error:', err);
                showAIError(err.message);
                resetGenerateBtn();
                return;
            }

            aiLoading.hidden = true;
        }

        // ===== Process with bleed =====
        if (useRedrawPadding) {
            // Redraw: place the AI image centered on the board with white padding + bleed
            gridResult = processImageWithPadding(imageToProcess, redrawFitW, redrawFitH, boardW, boardH);
        } else {
            // Basic & Create: fill the entire board
            gridResult = processImageWithBoard(imageToProcess, boardW, boardH);
        }

        // Generate BOM (exclude bleed)
        bomData = generateBOM(gridResult, true);

        workspace.hidden = false;
        renderGrid(gridResult, currentView, zoomLevel);
        fitCanvasZoom();
        renderBOM(bomData);
        showDimensionsInfo();
        workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });

        const modeLabels = { basic: '基础转换', redraw: 'AI重绘', create: 'AI创作' };
        showToast(`图纸已生成 ${gridResult.width}×${gridResult.height}（${modeLabels[currentMode]}）`);
    } catch (err) {
        console.error('[BeadCraft] Generate error:', err);
        showToast('生成失败: ' + err.message);
    }

    resetGenerateBtn();
}

function resetGenerateBtn() {
    generateBtn.disabled = false;
    generateBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        ${gridResult ? '重新生成' : '生成图纸'}
    `;
}

/**
 * Process image onto a board with bleed border
 * The center boardW×boardH area has the mapped image.
 * 1-pixel bleed border on all sides uses white beads.
 */
function processImageWithBoard(img, bW, bH) {
    const canvasW = bW + 2; // +1 bleed on each side
    const canvasH = bH + 2;

    // First get the inner grid (just the image mapped to boardW×boardH)
    const innerResult = processImage(img, bW, bH);

    // Import findNearestColor to get white bead for bleed
    // We use a known white color from the palette
    const whiteBead = findWhiteBead();

    // Build full grid with bleed
    const fullGrid = [];
    for (let y = 0; y < canvasH; y++) {
        const row = [];
        for (let x = 0; x < canvasW; x++) {
            // Is this in the bleed zone?
            if (x === 0 || x === canvasW - 1 || y === 0 || y === canvasH - 1) {
                row.push({ ...whiteBead, isBleed: true });
            } else {
                row.push({ ...innerResult.grid[y - 1][x - 1], isBleed: false });
            }
        }
        fullGrid.push(row);
    }

    return { grid: fullGrid, width: canvasW, height: canvasH, boardW: bW, boardH: bH };
}

/**
 * Process AI-generated image onto a board with WHITE PADDING + bleed.
 * Used for AI Redraw mode to preserve original aspect ratio.
 *
 * The AI image (fitW × fitH) is placed centered within the board (boardW × boardH).
 * Empty areas are filled with white beads.
 * 1-pixel bleed border surrounds the entire thing.
 *
 * @param {HTMLImageElement} img - AI-generated pixel art
 * @param {number} fitW - Width of the AI image area
 * @param {number} fitH - Height of the AI image area
 * @param {number} bW - Full board width
 * @param {number} bH - Full board height
 */
function processImageWithPadding(img, fitW, fitH, bW, bH) {
    const canvasW = bW + 2;
    const canvasH = bH + 2;

    // Process the AI image at its fit dimensions
    const innerResult = processImage(img, fitW, fitH);
    const whiteBead = findWhiteBead();

    // Calculate centering offsets within the board area
    const offsetX = Math.floor((bW - fitW) / 2);
    const offsetY = Math.floor((bH - fitH) / 2);

    const fullGrid = [];
    for (let y = 0; y < canvasH; y++) {
        const row = [];
        for (let x = 0; x < canvasW; x++) {
            // Bleed border
            if (x === 0 || x === canvasW - 1 || y === 0 || y === canvasH - 1) {
                row.push({ ...whiteBead, isBleed: true });
            } else {
                // Board coordinates (0-based within the board)
                const bx = x - 1;
                const by = y - 1;

                // Is this pixel within the centered AI image area?
                const imgX = bx - offsetX;
                const imgY = by - offsetY;

                if (imgX >= 0 && imgX < fitW && imgY >= 0 && imgY < fitH) {
                    row.push({ ...innerResult.grid[imgY][imgX], isBleed: false });
                } else {
                    // White padding
                    row.push({ ...whiteBead, isBleed: false });
                }
            }
        }
        fullGrid.push(row);
    }

    return { grid: fullGrid, width: canvasW, height: canvasH, boardW: bW, boardH: bH };
}

function findWhiteBead() {
    // Find the nearest-to-white bead in the palette
    return findNearestColor(255, 255, 255);
}

function showDimensionsInfo() {
    if (!gridResult) return;
    dimsInfo.hidden = false;
    dimsActual.textContent = `${boardW}×${boardH} 颗`;
    dimsCanvas.textContent = `${gridResult.width}×${gridResult.height} 颗`;

    // Count actual content beads (non-bleed, non-white-padding)
    let contentBeads = 0;
    let nonWhiteBeads = 0;
    const whiteHex = '#FFFFFF';
    for (const row of gridResult.grid) {
        for (const bead of row) {
            if (!bead.isBleed) {
                contentBeads++;
                if (bead.hex.toUpperCase() !== whiteHex) nonWhiteBeads++;
            }
        }
    }
    dimsContent.textContent = `${contentBeads} 颗（非白 ${nonWhiteBeads} 颗）`;
}

// ==================== BOM RENDERING ====================
function renderBOM(bom) {
    const sorted = sortBOM(bom.items, sortBy);
    bomList.innerHTML = '';

    sorted.forEach(item => {
        const el = document.createElement('div');
        el.className = 'bom-item';
        el.innerHTML = `
            <div class="bom-item__swatch" style="background-color: ${item.hex}"></div>
            <div class="bom-item__info">
                <span class="bom-item__name">${item.code}</span>
                <span class="bom-item__code">${item.hex}</span>
            </div>
            <span class="bom-item__count">${item.count}</span>
        `;

        el.addEventListener('mouseenter', () => {
            highlightColor(item.code);
            el.classList.add('highlighted');
        });
        el.addEventListener('mouseleave', () => {
            clearHighlight();
            el.classList.remove('highlighted');
        });

        bomList.appendChild(el);
    });

    bomTotalCount.textContent = `${bom.totalBeads} 颗`;
    bomColorCount.textContent = `${bom.totalColors} 种`;
}

// ==================== ZOOM ====================
function fitCanvasZoom() {
    if (!gridResult) return;
    const rect = canvasContainer.getBoundingClientRect();
    zoomLevel = calcFitZoom(rect.width - 40, rect.height - 40);
    zoomLevel = setZoom(zoomLevel);
    updateZoomUI();
}

function updateZoomUI() {
    zoomLevelEl.textContent = `${Math.round(zoomLevel * 100)}%`;
}

// ==================== FULLSCREEN PREVIEW ====================
function openFullscreenPreview() {
    if (!gridResult) return;
    previewModal.hidden = false;
    document.body.style.overflow = 'hidden';
    modalView = currentView;
    // Sync view buttons
    $$('.modal-view-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.view === modalView);
    });
    fitModalZoom();
}

function closeFullscreenPreview() {
    previewModal.hidden = true;
    document.body.style.overflow = '';
}

function fitModalZoom() {
    if (!gridResult) return;
    const rect = modalCanvasContainer.getBoundingClientRect();
    const baseCell = modalView === 'blueprint' ? 28 : 12;
    const maxNum = Math.max(gridResult.width, gridResult.height);
    const testCell = Math.max(4, Math.round(baseCell * 1));
    const margin = modalView === 'blueprint' ? calcMargin(maxNum, testCell) : 0;
    const idealW = (rect.width - 40 - margin * 2) / (gridResult.width * baseCell);
    const idealH = (rect.height - 40 - margin * 2) / (gridResult.height * baseCell);
    modalZoom = Math.min(idealW, idealH, 5);
    renderModalCanvas();
}

function renderModalCanvas() {
    if (!gridResult || !modalCanvas) return;

    const { grid, width, height } = gridResult;
    const baseCell = modalView === 'blueprint' ? 28 : 12;
    const cell = Math.max(4, Math.round(baseCell * modalZoom));
    const isBP = modalView === 'blueprint';
    const margin = isBP ? calcMargin(Math.max(width, height), cell) : 0;

    const canvasW = width * cell + margin * 2;
    const canvasH = height * cell + margin * 2;

    modalCanvas.width = canvasW;
    modalCanvas.height = canvasH;

    const mCtx = modalCanvas.getContext('2d');
    mCtx.clearRect(0, 0, canvasW, canvasH);

    // Margin background
    if (isBP) {
        mCtx.fillStyle = '#FAF6F1';
        mCtx.fillRect(0, 0, canvasW, canvasH);
    }

    // Draw beads
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const bead = grid[y][x];
            mCtx.fillStyle = bead.hex;
            const px = margin + x * cell;
            const py = margin + y * cell;

            if (modalView === 'clean') {
                const gap = cell > 8 ? 0.5 : 0;
                mCtx.fillRect(px + gap, py + gap, cell - gap * 2, cell - gap * 2);
            } else {
                mCtx.fillRect(px, py, cell, cell);
            }
        }
    }

    // Blueprint overlay: grid lines, major blocks, row/col numbers, color codes
    if (isBP) {
        renderBlueprintOverlay(mCtx, grid, width, height, cell, margin);
    }

    modalZoomLevel.textContent = `${Math.round(modalZoom * 100)}%`;
}

// ==================== SETTINGS ====================
function openSettings() {
    settingsModal.hidden = false;
    apiKeyInput.value = getApiKey();
}

function closeSettings() {
    settingsModal.hidden = true;
}

function saveSettings() {
    setApiKey(apiKeyInput.value);
    closeSettings();
    showToast('设置已保存');
}

// ==================== AI ERROR DISPLAY ====================
function showAIError(errorMessage) {
    // Transform the loading overlay into an error display
    const content = aiLoading.querySelector('.ai-loading__content');
    content.innerHTML = `
        <div style="color: #ef4444; margin-bottom: 16px;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
        </div>
        <p class="ai-loading__title" style="color: #ef4444;">AI 重绘失败</p>
        <div style="max-width: 480px; max-height: 200px; overflow-y: auto; margin: 12px auto; padding: 12px 16px;
            background: rgba(0,0,0,0.3); border-radius: 8px; font-family: 'JetBrains Mono', monospace;
            font-size: 12px; text-align: left; color: #fca5a5; line-height: 1.5; word-break: break-all;">
            ${errorMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
        </div>
        <button id="ai-error-close" style="margin-top: 16px; padding: 10px 28px; border-radius: 8px;
            background: rgba(255,255,255,0.15); color: #fff; border: 1px solid rgba(255,255,255,0.3);
            cursor: pointer; font-size: 14px;">
            关闭
        </button>
    `;
    document.getElementById('ai-error-close').addEventListener('click', () => {
        aiLoading.hidden = true;
        // Restore original loading content
        content.innerHTML = `
            <div class="ai-loading__spinner">
                <div class="ai-loading__ring"></div>
                <svg class="ai-loading__icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
            </div>
            <p class="ai-loading__title">AI 正在重绘...</p>
            <p class="ai-loading__sub">Gemini 正在将您的照片转化为精美像素画</p>
            <div class="ai-loading__progress"><div class="ai-loading__bar"></div></div>
        `;
    });
}

// ==================== TOAST ====================
function showToast(message) {
    toastText.textContent = message;
    toast.hidden = false;
    toast.offsetHeight; // force reflow
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => { toast.hidden = true; }, 300);
    }, 2500);
}

// ==================== SPINNER STYLES ====================
const style = document.createElement('style');
style.textContent = `
    @keyframes spin { to { transform: rotate(360deg); } }
    .spin { animation: spin 0.8s linear infinite; }
`;
document.head.appendChild(style);

// ==================== START ====================
init();
