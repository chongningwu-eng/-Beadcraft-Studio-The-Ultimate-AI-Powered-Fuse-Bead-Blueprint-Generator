/**
 * Storage Service — 图片上传 / 下载模块
 * Supabase Storage 封装
 */
import { supabase } from '../lib/supabase.js';

const ORIGINALS_BUCKET = 'originals';
const PIXELS_BUCKET = 'pixels';

/**
 * 上传原始图片
 * @param {string} userId 
 * @param {File|Blob} file
 * @param {string} [filename] — 不传则自动生成
 * @returns {Promise<{path: string, error: Error|null}>}
 */
export async function uploadOriginal(userId, file, filename) {
    const name = filename || `${Date.now()}_${file.name || 'upload.png'}`;
    const path = `${userId}/${name}`;

    const { data, error } = await supabase.storage
        .from(ORIGINALS_BUCKET)
        .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
        });

    return { path: data?.path ?? null, error };
}

/**
 * 上传像素图 / 缩略图
 * @param {string} userId
 * @param {Blob} blob — canvas.toBlob 生成的 Blob
 * @param {string} filename
 * @returns {Promise<{path: string, error: Error|null}>}
 */
export async function uploadPixelImage(userId, blob, filename) {
    const path = `${userId}/${filename}`;

    const { data, error } = await supabase.storage
        .from(PIXELS_BUCKET)
        .upload(path, blob, {
            contentType: 'image/png',
            cacheControl: '3600',
            upsert: false,
        });

    return { path: data?.path ?? null, error };
}

/**
 * 获取图片的公开 URL（signed URL，有效期 1 小时）
 * @param {'originals'|'pixels'} bucket
 * @param {string} path
 * @returns {Promise<{url: string, error: Error|null}>}
 */
export async function getSignedUrl(bucket, path) {
    const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 3600); // 1 hour

    return { url: data?.signedUrl ?? null, error };
}

/**
 * 获取图片公共 URL（仅在 bucket 为 public 时可用）
 * @param {'originals'|'pixels'} bucket
 * @param {string} path
 * @returns {string}
 */
export function getPublicUrl(bucket, path) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl ?? '';
}

/**
 * 删除存储中的文件
 * @param {'originals'|'pixels'} bucket
 * @param {string[]} paths
 */
export async function deleteFiles(bucket, paths) {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    return { error };
}
