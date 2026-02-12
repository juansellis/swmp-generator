-- Ensure authenticated users can read facilities (for Inputs page facility dropdown).
-- If "Authenticated users can read facilities" already exists from 20250203200000, this adds a second equivalent policy (OR).

CREATE POLICY "facilities_select_all_authenticated"
  ON public.facilities FOR SELECT
  TO authenticated
  USING (true);
