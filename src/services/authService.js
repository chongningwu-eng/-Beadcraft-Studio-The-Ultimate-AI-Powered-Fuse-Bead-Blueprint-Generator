/**
 * Auth Service — 用户认证模块
 * Google OAuth + Email OTP (Magic Link)
 */
import { supabase } from '../lib/supabase.js';

/**
 * Google OAuth 登录
 */
export async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
    });
    return { data, error };
}

/**
 * 发送邮箱 OTP 验证码
 * @param {string} email
 */
export async function sendOtp(email) {
    const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
    });
    return { data, error };
}

/**
 * 验证 OTP 验证码完成登录
 * @param {string} email
 * @param {string} token — 6 位验证码
 */
export async function verifyOtp(email, token) {
    const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
    });
    return { user: data?.user ?? null, session: data?.session ?? null, error };
}

/**
 * 登出
 */
export async function signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
}

/**
 * 获取当前已登录用户
 */
export async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

/**
 * 获取当前会话
 */
export async function getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

/**
 * 监听认证状态变化
 * @param {(event: string, session: object) => void} callback
 */
export function onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
}
