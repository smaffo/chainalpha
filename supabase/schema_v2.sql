-- Drop old tables
DROP TABLE IF EXISTS chain_results CASCADE;
DROP TABLE IF EXISTS theses CASCADE;

-- Trends (replaces theses)
CREATE TABLE trends (
  id serial PRIMARY KEY,
  title text,
  thesis_text text,
  created_at timestamp DEFAULT now()
);

-- Nodes
CREATE TABLE nodes (
  id serial PRIMARY KEY,
  trend_id int REFERENCES trends(id) ON DELETE CASCADE,
  name text,
  node_type text CHECK (node_type IN ('material','component','infrastructure','process','system')),
  position int,
  bottleneck_score int,
  bottleneck_reasoning text,
  explored boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);

-- Companies (deduplicated by ticker)
CREATE TABLE companies (
  id serial PRIMARY KEY,
  name text,
  ticker text UNIQUE,
  country text,
  description text,
  created_at timestamp DEFAULT now()
);

-- Junction
CREATE TABLE node_companies (
  id serial PRIMARY KEY,
  node_id int REFERENCES nodes(id) ON DELETE CASCADE,
  company_id int REFERENCES companies(id) ON DELETE CASCADE,
  chain_reasoning text,
  created_at timestamp DEFAULT now()
);
