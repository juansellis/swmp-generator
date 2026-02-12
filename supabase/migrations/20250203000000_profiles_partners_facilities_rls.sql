-- Profiles: one row per auth user; is_super_admin gates admin access.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_super_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can insert their own profile (so profile row exists).
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update own profile (server sets is_super_admin when env var lists email).
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Partners (companies)
CREATE TABLE IF NOT EXISTS public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  regions text[] NOT NULL DEFAULT '{}',
  partner_type text NOT NULL DEFAULT '',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins full access partners"
  ON public.partners
  FOR ALL
  USING (
    (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  )
  WITH CHECK (
    (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- Facilities (sites); partner_id references partners
CREATE TABLE IF NOT EXISTS public.facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
  name text NOT NULL,
  facility_type text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  accepted_streams text[] NOT NULL DEFAULT '{}',
  address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins full access facilities"
  ON public.facilities
  FOR ALL
  USING (
    (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  )
  WITH CHECK (
    (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_facilities_partner_id ON public.facilities(partner_id);
CREATE INDEX IF NOT EXISTS idx_facilities_region ON public.facilities(region);
