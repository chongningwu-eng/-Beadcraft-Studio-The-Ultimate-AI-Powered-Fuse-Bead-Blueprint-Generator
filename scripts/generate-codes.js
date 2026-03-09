#!/usr/bin/env node
/**
 * BeadCraft Studio — 邀请码批量生成器
 *
 * 用法:
 *   node scripts/generate-codes.js --count 50 --credits 10 --max-uses 1
 *
 * 参数:
 *   --count    生成数量 (默认 10)
 *   --credits  每码赋予的 AI 次数 (默认 10)
 *   --max-uses 每码最多被几人使用 (默认 1)
 *   --expires  过期天数 (默认 永不过期)
 *   --prefix   码前缀 (默认 BEAD)
 *
 * 环境变量 (写在 .env.local 或直接 export):
 *   SUPABASE_URL        — Supabase 项目 URL
 *   SUPABASE_SERVICE_KEY — Supabase service_role key (管理员 key)
 */

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ==================== 解析 .env.local ====================
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');

function loadEnv() {
    try {
        const content = readFileSync(envPath, 'utf-8');
        for (const line of content.split('\n')) {
            const match = line.match(/^\s*([\w]+)\s*=\s*(.+?)\s*$/);
            if (match && !process.env[match[1]]) {
                process.env[match[1]] = match[2];
            }
        }
    } catch { /* .env.local 不存在也可以用环境变量 */ }
}
loadEnv();

// ==================== 参数解析 ====================
const args = process.argv.slice(2);
function getArg(name, defaultVal) {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const COUNT = parseInt(getArg('count', '10'), 10);
const CREDITS = parseInt(getArg('credits', '10'), 10);
const MAX_USES = parseInt(getArg('max-uses', '1'), 10);
const EXPIRES_DAYS = getArg('expires', null);
const PREFIX = getArg('prefix', 'BEAD');

// ==================== Supabase 连接 ====================
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY; // 必须用 service_role key

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ 缺少环境变量:');
    console.error('   SUPABASE_URL (或 VITE_SUPABASE_URL)');
    console.error('   SUPABASE_SERVICE_KEY (管理员 key，在 Supabase Dashboard → Settings → API 中获取)');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ==================== 生成码 ====================
function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉容易混淆的 I/O/0/1
    const bytes = randomBytes(4);
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars[bytes[i] % chars.length];
    }
    return `${PREFIX}-${code}`;
}

async function main() {
    console.log(`\n🎲 生成 ${COUNT} 个邀请码 (每码 ${CREDITS} 次, 最多 ${MAX_USES} 人使用)\n`);

    const codes = [];
    const codeSet = new Set();

    while (codes.length < COUNT) {
        const code = generateCode();
        if (!codeSet.has(code)) {
            codeSet.add(code);
            const row = {
                code,
                credits: CREDITS,
                max_uses: MAX_USES,
            };
            if (EXPIRES_DAYS) {
                const d = new Date();
                d.setDate(d.getDate() + parseInt(EXPIRES_DAYS, 10));
                row.expires_at = d.toISOString();
            }
            codes.push(row);
        }
    }

    // 写入数据库
    const { data, error } = await supabase
        .from('invite_codes')
        .insert(codes)
        .select('code, credits, max_uses, expires_at');

    if (error) {
        console.error('❌ 写入失败:', error.message);
        process.exit(1);
    }

    // 输出结果
    console.log('✅ 生成成功！\n');
    console.log('CODE,CREDITS,MAX_USES,EXPIRES_AT');
    for (const row of data) {
        console.log(`${row.code},${row.credits},${row.max_uses},${row.expires_at || 'never'}`);
    }

    console.log(`\n📋 共 ${data.length} 个码已写入数据库。复制上方 CSV 到售卖平台即可。\n`);
}

main().catch(err => {
    console.error('❌ 错误:', err.message);
    process.exit(1);
});
