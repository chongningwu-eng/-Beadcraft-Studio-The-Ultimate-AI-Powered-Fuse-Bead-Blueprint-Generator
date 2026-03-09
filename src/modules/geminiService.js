/* ========================================
   Gemini Service — AI Pixel Art Generation
   ========================================
   
   Model: gemini-3.1-flash-image-preview (Nano Banana 2)
   Endpoint: generateContent (official REST API)
   Docs: https://ai.google.dev/gemini-api/docs/image-generation
   
   Two modes:
   1. AI 重绘 (Redraw)  — Preserve original composition, just clean up into pixel art
   2. AI 创作 (Create)  — Full creative pixel art from the subject
   ======================================== */

const GEMINI_MODEL = 'gemini-3.1-flash-image-preview';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ==================== API Key Management ====================
export function getApiKey() {
    return localStorage.getItem('beadcraft_gemini_key') || '';
}

export function setApiKey(key) {
    localStorage.setItem('beadcraft_gemini_key', key.trim());
}

export function hasApiKey() {
    return !!getApiKey();
}

// ==================== API Mode Management ====================
// 'own_key' = 用户自带 Key（免费无限）
// 'credits' = 使用站长 API，每次扣 1 credit
export function getApiMode() {
    return localStorage.getItem('beadcraft_api_mode') || 'credits';
}

export function setApiMode(mode) {
    localStorage.setItem('beadcraft_api_mode', mode);
}

// ==================== Image Utils ====================
function imageToBase64(source) {
    const canvas = document.createElement('canvas');
    canvas.width = source.naturalWidth;
    canvas.height = source.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const base64 = dataUrl.split(',')[1];
    return { base64, mimeType: 'image/jpeg' };
}

// ==================== Core API Call ====================
async function callGeminiImageAPI(prompt, imageBase64, imageMimeType) {
    const apiMode = getApiMode();
    let apiKey;

    if (apiMode === 'own_key') {
        apiKey = getApiKey();
        if (!apiKey) throw new Error('请先在设置中配置 Gemini API Key');
    } else {
        // credits 模式：使用站长的 API Key
        apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) throw new Error('系统 API 暂不可用，请切换到自带 Key 模式');

        // 先检查余额
        const { getBalance, consumeCredit } = await import('../services/creditService.js');
        const balance = await getBalance();
        if (balance <= 0) {
            throw new Error('AI 次数已用完，请兑换邀请码或购买次数');
        }

        // 预扣 1 次（先扣再调用，防止失败后白用）
        const consumeResult = await consumeCredit();
        if (!consumeResult.success) {
            throw new Error(consumeResult.error || 'AI 次数扣除失败');
        }
    }

    const parts = [{ text: prompt }];
    if (imageBase64) {
        parts.push({
            inline_data: {
                mime_type: imageMimeType,
                data: imageBase64
            }
        });
    }

    const requestBody = {
        contents: [{ parts }],
        generationConfig: {
            responseModalities: ['Image']
        }
    };

    console.log(`[Gemini] Calling ${GEMINI_MODEL} (mode: ${apiMode})...`);
    console.log(`[Gemini] Prompt: ${prompt.substring(0, 120)}...`);

    let response;
    try {
        response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            },
            body: JSON.stringify(requestBody)
        });
    } catch (networkError) {
        throw new Error(`网络请求失败: ${networkError.message}`);
    }

    if (!response.ok) {
        let errorDetail = `HTTP ${response.status} ${response.statusText}`;
        try {
            const errorData = await response.json();
            errorDetail = errorData?.error?.message || JSON.stringify(errorData, null, 2);
        } catch { try { errorDetail = await response.text(); } catch { } }
        console.error('[Gemini] API Error:', errorDetail);
        throw new Error(`Gemini API 错误 (${response.status}): ${errorDetail}`);
    }

    let data;
    try { data = await response.json(); } catch {
        throw new Error('Gemini 返回了非 JSON 格式的响应');
    }

    console.log('[Gemini] Response OK, parsing...');

    const candidates = data.candidates || [];
    if (!candidates.length) {
        const blockReason = data.promptFeedback?.blockReason;
        throw new Error(blockReason
            ? `Gemini 拒绝了请求 (安全过滤): ${blockReason}`
            : 'Gemini 未返回任何候选结果');
    }

    const parts2 = candidates[0].content?.parts || [];
    const imagePart = parts2.find(p => p.inlineData?.mimeType?.startsWith('image/'));

    if (!imagePart) {
        const textParts = parts2.filter(p => p.text).map(p => p.text).join('\n');
        const finishReason = candidates[0].finishReason || 'UNKNOWN';
        let msg = `Gemini 未生成图像 (finishReason: ${finishReason})`;
        if (textParts) msg += `\n模型回复: ${textParts.substring(0, 300)}`;
        throw new Error(msg);
    }

    const imgSrc = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            console.log(`[Gemini] Image: ${img.naturalWidth}×${img.naturalHeight}`);
            resolve(img);
        };
        img.onerror = () => reject(new Error('生成的图像加载失败'));
        img.src = imgSrc;
    });
}

// ==================== AI 重绘 Mode ====================
/**
 * AI Redraw: Convert photo to pixel art while PRESERVING original composition.
 * - Keeps original aspect ratio (do NOT force square)
 * - Preserves spatial layout of elements
 * - Just makes it cleaner with solid-color pixel blocks
 *
 * @param {HTMLImageElement} sourceImage
 * @param {number} boardW - Board width (beads)
 * @param {number} boardH - Board height (beads)
 * @returns {Promise<HTMLImageElement>}
 */
export async function generatePixelArtRedraw(sourceImage, boardW, boardH) {
    const { base64, mimeType } = imageToBase64(sourceImage);

    const prompt = `You are a pixel art converter. Transform this photograph into clean pixel art.

CRITICAL RULES:
- Output MUST be exactly ${boardW} pixels wide × ${boardH} pixels tall
- PRESERVE the original image's composition, subject positions, and layout EXACTLY
- Do NOT crop, reframe, or move any elements — keep everything in the same position
- Each pixel = one physical bead, so every pixel must be ONE solid flat color
- NO gradients, NO anti-aliasing, NO blending between adjacent pixels
- Simplify colors into clean flat blocks, but maintain recognizable shapes and features
- Keep clear edges between color regions
- Use approximately 25-50 distinct colors total
- The result should look like a polished 8-bit pixel art version of the SAME photo
- If the subject doesn't fill the canvas, empty areas should be white (#FFFFFF)

Output ONLY the ${boardW}×${boardH} pixel image. No text.`;

    return callGeminiImageAPI(prompt, base64, mimeType);
}

// ==================== AI 创作 Mode ====================
/**
 * AI Create: Extract subject and create a fully new pixel art piece.
 * - Full creative freedom to reimagine the subject
 * - Cute chibi/sprite style
 * - User specifies exact canvas size
 *
 * @param {HTMLImageElement} sourceImage
 * @param {number} canvasW - Output width (beads)
 * @param {number} canvasH - Output height (beads)
 * @returns {Promise<HTMLImageElement>}
 */
export async function generatePixelArtCreate(sourceImage, canvasW, canvasH) {
    const { base64, mimeType } = imageToBase64(sourceImage);

    const prompt = `You are a creative pixel art designer specializing in fuse bead art (拼豆).

Look at this photograph and CREATE a brand new pixel art character/scene inspired by it.

CREATIVE RULES:
- Output MUST be exactly ${canvasW} pixels wide × ${canvasH} pixels tall
- Extract the main subject from the photo and reimagine it as cute pixel art
- Style: adorable chibi/kawaii pixel art, like a game sprite or fuse bead pattern
- Use clean solid-color blocks — each pixel = one bead, so NO gradients or anti-aliasing
- Bold outlines, expressive features, simplified but charming design
- Use approximately 20-40 vibrant distinct colors
- Fill the entire ${canvasW}×${canvasH} canvas with the design
- The background can be a simple solid color or transparent (white)
- Make it look beautiful when physically assembled as a fuse bead art piece

Output ONLY the ${canvasW}×${canvasH} pixel image. No text.`;

    return callGeminiImageAPI(prompt, base64, mimeType);
}
