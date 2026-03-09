-- ============================================================
-- BeadCraft Studio — Credits & Invite Codes Schema
-- 在 Supabase Dashboard → SQL Editor 中执行此文件
-- ============================================================

-- ==================== INVITE CODES ====================
CREATE TABLE IF NOT EXISTS public.invite_codes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT UNIQUE NOT NULL,
    credits     INT NOT NULL DEFAULT 10,
    max_uses    INT NOT NULL DEFAULT 1,
    used_count  INT NOT NULL DEFAULT 0,
    expires_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON public.invite_codes(code);

-- ==================== CREDIT BALANCES ====================
CREATE TABLE IF NOT EXISTS public.credit_balances (
    user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    balance     INT NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ==================== CREDIT TRANSACTIONS ====================
CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount      INT NOT NULL,
    type        TEXT NOT NULL CHECK (type IN ('redeem', 'consume', 'purchase', 'bonus')),
    ref_id      TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_created ON public.credit_transactions(created_at DESC);

-- ==================== PROFILES 扩展 ====================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS api_mode TEXT DEFAULT 'credits';

-- ==================== 兑换码原子兑换函数 ====================
CREATE OR REPLACE FUNCTION public.redeem_invite_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invite   invite_codes%ROWTYPE;
    v_user_id  UUID;
    v_existing credit_transactions%ROWTYPE;
BEGIN
    -- 获取当前用户
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '请先登录');
    END IF;

    -- 查找邀请码
    SELECT * INTO v_invite FROM invite_codes WHERE code = UPPER(TRIM(p_code));
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', '邀请码不存在');
    END IF;

    -- 检查过期
    IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
        RETURN jsonb_build_object('success', false, 'error', '邀请码已过期');
    END IF;

    -- 检查使用次数
    IF v_invite.used_count >= v_invite.max_uses THEN
        RETURN jsonb_build_object('success', false, 'error', '邀请码已被使用完');
    END IF;

    -- 检查该用户是否已兑换过这个码
    SELECT * INTO v_existing FROM credit_transactions
        WHERE user_id = v_user_id AND type = 'redeem' AND ref_id = v_invite.code
        LIMIT 1;
    IF FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', '你已经使用过这个邀请码');
    END IF;

    -- 执行兑换（原子操作）
    UPDATE invite_codes SET used_count = used_count + 1 WHERE id = v_invite.id;

    INSERT INTO credit_balances (user_id, balance, updated_at)
        VALUES (v_user_id, v_invite.credits, now())
        ON CONFLICT (user_id)
        DO UPDATE SET balance = credit_balances.balance + v_invite.credits, updated_at = now();

    INSERT INTO credit_transactions (user_id, amount, type, ref_id)
        VALUES (v_user_id, v_invite.credits, 'redeem', v_invite.code);

    RETURN jsonb_build_object(
        'success', true,
        'credits_added', v_invite.credits,
        'message', '兑换成功！获得 ' || v_invite.credits || ' 次 AI 使用次数'
    );
END;
$$;

-- ==================== 消耗 1 次 credits 函数 ====================
CREATE OR REPLACE FUNCTION public.consume_credit()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_balance INT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '请先登录');
    END IF;

    SELECT balance INTO v_balance FROM credit_balances WHERE user_id = v_user_id;
    IF NOT FOUND OR v_balance <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'AI 次数已用完', 'balance', 0);
    END IF;

    UPDATE credit_balances SET balance = balance - 1, updated_at = now() WHERE user_id = v_user_id;

    INSERT INTO credit_transactions (user_id, amount, type)
        VALUES (v_user_id, -1, 'consume');

    RETURN jsonb_build_object('success', true, 'balance', v_balance - 1);
END;
$$;

-- ==================== RLS ====================
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- invite_codes: 无人可直接读写（仅通过 RPC 兑换）
-- 但需要允许 RPC 函数访问（SECURITY DEFINER 已处理）

-- credit_balances: 用户只能查自己的
DROP POLICY IF EXISTS "Users can view own balance" ON public.credit_balances;
CREATE POLICY "Users can view own balance" ON public.credit_balances
    FOR SELECT USING (auth.uid() = user_id);

-- credit_transactions: 用户只能查自己的
DROP POLICY IF EXISTS "Users can view own transactions" ON public.credit_transactions;
CREATE POLICY "Users can view own transactions" ON public.credit_transactions
    FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- 执行完毕。
-- 还需要在 Supabase Dashboard → Auth → Settings 开启 Allow anonymous sign-ins
-- ============================================================
