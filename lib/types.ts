export interface Company {
  name: string;
  ticker: string;
  marketCap: string;
  description: string;
  chain_reasoning: string;
  bottleneck: boolean;
  analyst_coverage: "heavy" | "moderate" | "light" | "minimal";
  alphaScore: string;
  supply_chain_node?: string;
}

export interface ThesisResult {
  tier0: Company[];
  tier1: Company[];
  tier2: Company[];
  tier3: Company[];
}

export interface SavedThesis {
  id: number;
  thesis_text: string;
  title: string;
  created_at: string;
  last_mapped_at: string;
  company_count: number;
  tier0_count: number;
  tier1_count: number;
  tier2_count: number;
  tier3_count: number;
  bottleneck_count: number;
}
