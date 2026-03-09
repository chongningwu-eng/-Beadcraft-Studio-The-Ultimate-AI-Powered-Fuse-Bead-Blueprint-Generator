/**
 * Credit Service — AI 次数管理
 * 兑换邀请码 / 查询余额 / 消耗次数 / 购买（占位）
 */
import { supabase } from '../lib/supabase.js';

/**
 * 获取当前用户的 AI 余额
 * @returns {Promise<number>}
 */
export async function getBalance() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { data, error } = await supabase
        .from('credit_balances')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();

    if (error) {
        console.error('[Credits] getBalance error:', error);
        return 0;
    }
    return data?.balance ?? 0;
}

/**
 * 兑换邀请码
 * @param {string} code
 * @returns {Promise<{success: boolean, credits_added?: number, message?: string, error?: string}>}
 */
export async function redeemCode(code) {
    const { data, error } = await supabase.rpc('redeem_invite_code', {
        p_code: code,
    });

    if (error) {
        console.error('[Credits] redeemCode RPC error:', error);
        return { success: false, error: error.message };
    }
    return data;
}

/**
 * 消耗 1 次 AI credit
 * @returns {Promise<{success: boolean, balance?: number, error?: string}>}
 */
export async function consumeCredit() {
    const { data, error } = await supabase.rpc('consume_credit');

    if (error) {
        console.error('[Credits] consumeCredit RPC error:', error);
        return { success: false, error: error.message };
    }
    return data;
}

/**
 * 获取交易记录
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export async function getTransactions(limit = 20) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('[Credits] getTransactions error:', error);
        return [];
    }
    return data || [];
}

// ==================== Stripe 占位 ====================

/**
 * 创建 Stripe Checkout Session（占位）
 * TODO: 接入真实 Stripe 后端
 * @param {number} credits — 购买的次数包
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export async function purchaseCredits(credits) {
    // TODO: 调用后端 API 创建 Stripe Checkout Session
    // const { data, error } = await supabase.functions.invoke('create-checkout', {
    //     body: { credits }
    // });
    // if (error) return { success: false, error: error.message };
    // window.location.href = data.url;
    return {
        success: false,
        error: '站内购买即将上线，敬请期待！',
    };
}
