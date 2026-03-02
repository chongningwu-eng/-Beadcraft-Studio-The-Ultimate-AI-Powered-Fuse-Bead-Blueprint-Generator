/* ========================================
   Image Processor — Resize & Pixel Sample
   ======================================== */

import { findNearestColor } from './colorCard.js';

/**
 * Load an image file into an HTMLImageElement
 * @param {File} file
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImageFile(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
        };
        img.src = url;
    });
}

/**
 * Process an image: resize to target resolution and map each pixel to nearest bead color
 *
 * @param {HTMLImageElement} img - The source image
 * @param {number} targetW - Target width in "pixels" (beads)
 * @param {number} targetH - Target height in "pixels" (beads)
 * @returns {{ grid: { code: string, name: string, r: number, g: number, b: number, hex: string }[][], width: number, height: number }}
 */
export function processImage(img, targetW, targetH) {
    // Create an offscreen canvas at target resolution
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Disable image smoothing for crisp pixel sampling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';

    // Draw image scaled down to target resolution
    ctx.drawImage(img, 0, 0, targetW, targetH);

    // Extract pixel data
    const imageData = ctx.getImageData(0, 0, targetW, targetH);
    const data = imageData.data;

    // Map each pixel to nearest bead color
    const grid = [];
    for (let y = 0; y < targetH; y++) {
        const row = [];
        for (let x = 0; x < targetW; x++) {
            const i = (y * targetW + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            // const a = data[i + 3]; // alpha (ignored for now)

            const nearest = findNearestColor(r, g, b);
            row.push(nearest);
        }
        grid.push(row);
    }

    return { grid, width: targetW, height: targetH };
}

/**
 * Calculate appropriate target dimensions maintaining aspect ratio
 * @param {number} imgW - Original image width
 * @param {number} imgH - Original image height
 * @param {number} targetW - Desired width
 * @param {boolean} lockRatio - Whether to preserve aspect ratio
 * @returns {{ w: number, h: number }}
 */
export function calcDimensions(imgW, imgH, targetW, targetH, lockRatio) {
    if (!lockRatio) return { w: targetW, h: targetH };

    const ratio = imgW / imgH;
    // Use width as primary, calculate height from ratio
    const h = Math.round(targetW / ratio);
    return { w: targetW, h: Math.max(1, h) };
}
