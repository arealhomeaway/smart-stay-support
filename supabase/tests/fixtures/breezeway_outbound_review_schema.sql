-- Minimal fixture so the two REAL migration files can be applied unmodified
-- against a disposable Postgres, to prove the actual constraint shapes (not
-- a reconstruction of them) hold as the application code assumes.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid());

CREATE SCHEMA IF NOT EXISTS public;

CREATE TABLE public.tickets (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.onboarding_tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.properties (id uuid PRIMARY KEY DEFAULT gen_random_uuid());

-- Stubs only so the real migration's RLS policy (not under test here) can be
-- created; this test never authenticates as a real user or exercises RLS.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
CREATE OR REPLACE FUNCTION public.has_role(uuid, text) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.feature_flags (
  key text PRIMARY KEY,
  label text,
  description text,
  enabled boolean NOT NULL DEFAULT false
);
