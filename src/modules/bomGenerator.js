/* ========================================
   BOM (Bill of Materials) Generator
   ======================================== */

/**
 * Generate a Bill of Materials from the bead grid
 * @param {{ grid: any[][], width: number, height: number }} result
 * @param {boolean} excludeBleed - If true, exclude beads marked as bleed
 * @returns {{ items: { code: string, name: string, hex: string, r: number, g: number, b: number, count: number }[], totalBeads: number, totalColors: number }}
 */
export function generateBOM(result, excludeBleed = false) {
    const { grid, width, height } = result;
    const counts = new Map();

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const bead = grid[y][x];

            // Skip bleed beads if requested
            if (excludeBleed && bead.isBleed) continue;

            const key = bead.code;
            if (counts.has(key)) {
                counts.get(key).count++;
            } else {
                counts.set(key, {
                    code: bead.code,
                    name: bead.name,
                    hex: bead.hex,
                    r: bead.r,
                    g: bead.g,
                    b: bead.b,
                    count: 1,
                });
            }
        }
    }

    const items = Array.from(counts.values());
    const totalBeads = items.reduce((sum, item) => sum + item.count, 0);
    const totalColors = items.length;

    return { items, totalBeads, totalColors };
}

/**
 * Sort BOM items
 * @param {any[]} items
 * @param {'count'|'code'} sortBy
 * @returns {any[]}
 */
export function sortBOM(items, sortBy = 'count') {
    return [...items].sort((a, b) => {
        if (sortBy === 'count') return b.count - a.count;
        return a.code.localeCompare(b.code, undefined, { numeric: true });
    });
}
