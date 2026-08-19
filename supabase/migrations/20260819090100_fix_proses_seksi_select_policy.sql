-- Correct the historical policy that was accidentally created on proses.
DROP POLICY IF EXISTS "anon_select_proses_seksi" ON proses;
DROP POLICY IF EXISTS "anon_select_proses_seksi" ON proses_seksi;
CREATE POLICY "anon_select_proses_seksi" ON proses_seksi FOR SELECT
  TO anon, authenticated USING (true);
