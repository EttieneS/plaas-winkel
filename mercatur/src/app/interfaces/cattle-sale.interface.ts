export interface CattleSale {
  id: number;
  reference: string;
  owner_user_id: number;
  estimated_weight_kg: string;
  price_per_kg: string;
  available_weight_kg: string;
  description: string | null;
  committed_weight_kg: string;
  remaining_weight_kg: string;
  percentage_committed: number;
  status: 'OPEN' | 'FULLY_COMMITTED';
  created_at: string;
  updated_at: string;
}

export interface MarketplaceCattleSale {
  id: number;
  reference: string;
  estimated_weight_kg: string;
  committed_weight_kg: string;
  remaining_weight_kg: string;
  available_weight_kg: string;
  percentage_committed: number;
  price_per_kg: string;
  status: 'OPEN' | 'FULLY_COMMITTED';
  description: string | null;
  created_at: string;
  can_reserve: boolean;
}

export interface CattleSaleReservation {
  commitment: {
    id: number;
    cattle_sale_id: number;
    quantity_kg: string;
    price_per_kg: string;
    total_amount: string;
    status: 'CONFIRMED';
  };
  sale: MarketplaceCattleSale;
}

export interface CreateCattleSaleRequest {
  estimated_weight_kg: number;
  price_per_kg: number;
  description: string | null;
}
