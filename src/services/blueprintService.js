/**
 * Blueprint Service — 图纸资产 CRUD 模块
 * 管理图纸的创建、查询、更新、删除
 */
import { supabase } from '../lib/supabase.js';

/**
 * 保存新图纸
 * @param {object} blueprint
 * @param {string} blueprint.userId
 * @param {string} blueprint.title
 * @param {'basic'|'redraw'|'create'} blueprint.mode
 * @param {number} blueprint.boardWidth
 * @param {number} blueprint.boardHeight
 * @param {number} [blueprint.bleed=1]
 * @param {string} [blueprint.brand='mard']
 * @param {string|null} blueprint.originalImagePath
 * @param {string|null} blueprint.pixelImagePath
 * @param {string|null} blueprint.thumbnailPath
 * @param {Array<{id: string, hex: string, count: number}>} blueprint.bom
 * @param {number} blueprint.totalBeads
 * @param {number} blueprint.colorCount
 * @returns {Promise<{data, error}>}
 */
export async function saveBlueprint(blueprint) {
    const { data, error } = await supabase
        .from('blueprints')
        .insert({
            user_id: blueprint.userId,
            title: blueprint.title || '未命名图纸',
            mode: blueprint.mode,
            board_width: blueprint.boardWidth,
            board_height: blueprint.boardHeight,
            bleed: blueprint.bleed ?? 1,
            brand: blueprint.brand ?? 'mard',
            original_image_path: blueprint.originalImagePath,
            pixel_image_path: blueprint.pixelImagePath,
            thumbnail_path: blueprint.thumbnailPath,
            bom: blueprint.bom,
            total_beads: blueprint.totalBeads,
            color_count: blueprint.colorCount,
        })
        .select()
        .single();

    return { data, error };
}

/**
 * 获取当前用户的所有图纸（分页）
 * @param {string} userId
 * @param {number} [page=1]
 * @param {number} [pageSize=12]
 * @returns {Promise<{data: Array, count: number, error}>}
 */
export async function getBlueprints(userId, page = 1, pageSize = 12) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
        .from('blueprints')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to);

    return { data, count, error };
}

/**
 * 获取单张图纸详情
 * @param {string} blueprintId
 * @returns {Promise<{data, error}>}
 */
export async function getBlueprint(blueprintId) {
    const { data, error } = await supabase
        .from('blueprints')
        .select('*')
        .eq('id', blueprintId)
        .single();

    return { data, error };
}

/**
 * 更新图纸标题
 * @param {string} blueprintId
 * @param {string} title
 */
export async function updateBlueprintTitle(blueprintId, title) {
    const { data, error } = await supabase
        .from('blueprints')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('id', blueprintId)
        .select()
        .single();

    return { data, error };
}

/**
 * 删除图纸（同时需要在调用处清理 Storage 文件）
 * @param {string} blueprintId
 */
export async function deleteBlueprint(blueprintId) {
    // 先获取图纸以拿到文件路径
    const { data: bp, error: fetchError } = await getBlueprint(blueprintId);
    if (fetchError) return { error: fetchError };

    // 删除数据库记录
    const { error } = await supabase
        .from('blueprints')
        .delete()
        .eq('id', blueprintId);

    // 返回被删除的图纸数据，供调用方清理 Storage
    return { deletedBlueprint: bp, error };
}
