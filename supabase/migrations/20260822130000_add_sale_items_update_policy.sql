-- sale_items has never had an UPDATE RLS policy (only SELECT/INSERT, and DELETE for admins).
-- Setting item-level referral commissions is the first client-side path that updates
-- sale_items, and without a policy the UPDATE silently affects 0 rows, which then makes
-- the trailing .select().single() fail with "cannot coerce the result to a single JSON object".

CREATE POLICY "Admin can update sale items"
  ON sale_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
