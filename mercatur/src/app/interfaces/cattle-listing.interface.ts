export interface CreateCattleListingRequest {
  title: string;
  description: string | null;
  carcass_weight_kg: number;
  price_per_kg: number;
}

export interface CattleListing {
  id: number;
  farmer_id: number;
  title: string;
  description: string | null;
  carcass_weight_kg: string;
  price_per_kg: string;
  total_value: string;
  status: 'DRAFT' | 'PUBLISHED' | 'SOLD' | 'CANCELLED';
  published_at: string | null;
  created_at: string;
  updated_at: string;
}
