/* ========================================
   Color Utility Functions
   ======================================== */

/**
 * Weighted Euclidean color distance (CIEDE-like approximation)
 * Accounts for human eye's greater sensitivity to green
 */
export function colorDistance(r1, g1, b1, r2, g2, b2) {
    const rMean = (r1 + r2) / 2;
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return Math.sqrt(
        (2 + rMean / 256) * dr * dr +
        4 * dg * dg +
        (2 + (255 - rMean) / 256) * db * db
    );
}

/**
 * Convert HEX (#RRGGBB) to RGB array
 */
export function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [
        parseInt(h.substring(0, 2), 16),
        parseInt(h.substring(2, 4), 16),
        parseInt(h.substring(4, 6), 16),
    ];
}

/**
 * Convert RGB array to HEX string
 */
export function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Get relative luminance (for contrast ratio)
 */
export function luminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Determine if text should be white or dark based on background color
 */
export function getContrastColor(r, g, b) {
    return luminance(r, g, b) > 0.4 ? '#1A1815' : '#FFFFFF';
}
