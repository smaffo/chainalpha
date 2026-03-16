export interface Trend {
  id: number;
  title: string;
  thesis_text: string;
  created_at: string;
  node_count?: number;
  explored_count?: number;
  max_bottleneck?: number;
}

export type NodeType = 'material' | 'component' | 'infrastructure' | 'process' | 'system';

export interface SupplyNode {
  id: number;
  trend_id: number;
  name: string;
  node_type: NodeType;
  position: number;
  bottleneck_score: number;
  bottleneck_reasoning: string;
  explored: boolean;
  created_at: string;
}

export interface NodeCompany {
  id: number;          // node_companies.id
  company_id: number;
  name: string;
  ticker: string;
  country: string;
  description: string;
  chain_reasoning: string;
}

export interface RadarCompany {
  company_id: number;
  name: string;
  ticker: string;
  country: string;
  trend_count: number;
  avg_bottleneck: number;
  node_count: number;
  signal_score: number;
  appearances: Array<{
    trend_id: number;
    trend_title: string;
    node_name: string;
    bottleneck_score: number;
  }>;
}

// Keep for watchlist/suggestions (unchanged pages)
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
