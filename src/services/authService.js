/**
 * Auth Service — 用户认证模块
 * 封装 Supabase Auth 的注册、登录、登出、状态监听
 */
import { supabase } from '../lib/supabase.js';

/**
 * 使用邮箱 + 密码注册
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user, error}>}
 */
export async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });
    return { user: data?.user ?? null, error };
}

/**
 * 使用邮箱 + 密码登录
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user, session, error}>}
 */
export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    return { user: data?.user ?? null, session: data?.session ?? null, error };
}

/**
 * OAuth 登录（Google / GitHub 等）
 * @param {'google'|'github'} provider
 */
export async function signInWithOAuth(provider) {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
    });
    return { data, error };
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
 * @returns {Promise<import('@supabase/supabase-js').User|null>}
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
 * @returns {{ data: { subscription } }} — 调用 subscription.unsubscribe() 取消监听
 */
export function onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
}
