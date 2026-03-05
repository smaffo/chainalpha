-- ChainAlpha database schema for Supabase
-- Run this in the Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS theses (
  id serial primary key,
  thesis_text text,
  title text,
  created_at timestamp default now(),
  last_mapped_at timestamp default now()
);

CREATE TABLE IF NOT EXISTS chain_results (
  id serial primary key,
  thesis_id integer references theses(id) on delete cascade,
  tier integer,
  company_name text,
  ticker text,
  market_cap text,
  description text,
  chain_reasoning text,
  bottleneck boolean default false,
  analyst_coverage text,
  alpha_score text,
  created_at timestamp default now()
);

CREATE TABLE IF NOT EXISTS suggested_theses (
  id serial primary key,
  title text,
  thesis_text text,
  catalyst text,
  created_at timestamp default now()
);

CREATE TABLE IF NOT EXISTS watchlist (
  id serial primary key,
  title text,
  thesis_text text,
  catalyst text,
  added_at timestamp default now()
);
