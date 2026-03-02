/* ========================================
   CSV Color Card Parser & Nearest-Color Engine
   ======================================== */

import { colorDistance, hexToRgb } from '../utils/colorUtils.js';

/** @type {{ code: string, name: string, r: number, g: number, b: number, hex: string }[]} */
let colorPalette = [];

/**
 * Load and parse the CSV color card file
 */
export async function loadColorCard(csvPath = '/电子色号.csv') {
    const response = await fetch(csvPath);
    if (!response.ok) throw new Error(`Failed to load color card: ${response.statusText}`);

    const text = await response.text();
    const lines = text.trim().split('\n');

    // Skip header row
    colorPalette = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',');
        if (parts.length < 6) continue;

        const [code, name, r, g, b, hex] = parts;
        colorPalette.push({
            code: code.trim(),
            name: name.trim(),
            r: parseInt(r.trim(), 10),
            g: parseInt(g.trim(), 10),
            b: parseInt(b.trim(), 10),
            hex: hex.trim(),
        });
    }

    console.log(`[ColorCard] Loaded ${colorPalette.length} bead colors`);
    return colorPalette;
}

/**
 * Find the nearest color in the palette for a given RGB value
 * Uses a pre-computed cache for performance
 */
const nearestCache = new Map();

export function findNearestColor(r, g, b) {
    const key = (r << 16) | (g << 8) | b;
    if (nearestCache.has(key)) return nearestCache.get(key);

    let minDist = Infinity;
    let nearest = colorPalette[0];

    for (const color of colorPalette) {
        const dist = colorDistance(r, g, b, color.r, color.g, color.b);
        if (dist < minDist) {
            minDist = dist;
            nearest = color;
            if (dist === 0) break; // Exact match
        }
    }

    nearestCache.set(key, nearest);
    return nearest;
}

/**
 * Clear the nearest-color cache (call when palette changes)
 */
export function clearCache() {
    nearestCache.clear();
}

/**
 * Get the full palette
 */
export function getPalette() {
    return colorPalette;
}
