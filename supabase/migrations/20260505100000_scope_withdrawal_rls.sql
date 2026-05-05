-- ============================================================
-- Scope withdrawal request access by franchise
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS "Agents can view own withdrawals" ON withdrawal_requests;
DROP POLICY IF EXISTS "Agents can insert own withdrawals" ON withdrawal_requests;
DROP POLICY IF EXISTS "Admins can view all withdrawals" ON withdrawal_requests;
DROP POLICY IF EXISTS "Admins can update withdrawals" ON withdrawal_requests;

CREATE POLICY "Users can view own withdrawals"
    ON withdrawal_requests FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own withdrawals"
    ON withdrawal_requests FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all withdrawals"
    ON withdrawal_requests FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles actor
            WHERE actor.id = auth.uid()
              AND actor.role = 'admin'
        )
    );

CREATE POLICY "Franchises can view franchise withdrawals"
    ON withdrawal_requests FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles actor
            JOIN profiles target ON target.id = withdrawal_requests.user_id
            WHERE actor.id = auth.uid()
              AND actor.role = 'franchise'
              AND actor.franchise_id IS NOT NULL
              AND target.franchise_id = actor.franchise_id
        )
    );

CREATE POLICY "Admins can update all withdrawals"
    ON withdrawal_requests FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles actor
            WHERE actor.id = auth.uid()
              AND actor.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles actor
            WHERE actor.id = auth.uid()
              AND actor.role = 'admin'
        )
    );

CREATE POLICY "Franchises can update franchise withdrawals"
    ON withdrawal_requests FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles actor
            JOIN profiles target ON target.id = withdrawal_requests.user_id
            WHERE actor.id = auth.uid()
              AND actor.role = 'franchise'
              AND actor.franchise_id IS NOT NULL
              AND target.franchise_id = actor.franchise_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles actor
            JOIN profiles target ON target.id = withdrawal_requests.user_id
            WHERE actor.id = auth.uid()
              AND actor.role = 'franchise'
              AND actor.franchise_id IS NOT NULL
              AND target.franchise_id = actor.franchise_id
        )
    );

COMMIT;
