export type CattleSaleStatus = 'OPEN' | 'TARGET_REACHED' | 'ACCEPTED' | 'SLAUGHTERED'
  | 'PROCESSING' | 'READY_FOR_FULFILMENT' | 'FULFILLED';

export interface MyCattleReservation {
  id: number;
  quantity_kg: string;
  price_per_kg: string;
  total_amount: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  fulfilment_state: 'UNFULFILLED' | 'COLLECTED' | 'DELIVERED';
  fulfilled_at: string | null;
  created_at: string;
  sale: {
    id: number;
    reference: string;
    status: CattleSaleStatus;
    estimated_weight_kg: string;
    committed_weight_kg: string;
    percentage_committed: number;
    fulfilment_due_at: string | null;
    ready_for_fulfilment_at: string | null;
  };
}

export interface MyCattleReservationsPage {
  reservations: MyCattleReservation[];
  pagination: { current_page: number; last_page: number; per_page: number; total: number };
}

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
  status: CattleSaleStatus;
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
  status: CattleSaleStatus;
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

export type CattleFulfilmentAction = 'ACCEPT' | 'RECORD_SLAUGHTER' | 'START_PROCESSING' | 'MARK_READY';
export interface CattleStageEvidence {
  occurred_at: string;
  processor_name: string;
  batch_reference: string;
  notes: string | null;
}

export interface FarmerCattleReservation {
  id: number;
  buyer_name: string;
  quantity_kg: string;
  price_per_kg: string;
  total_amount: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  fulfilment_state: 'UNFULFILLED' | 'COLLECTED' | 'DELIVERED';
  fulfilled_at: string | null;
  permitted_actions: ('COLLECT' | 'DELIVER')[];
}

export interface CattleSaleDetails {
  id: number;
  reference: string;
  description: string | null;
  estimated_weight_kg: string;
  committed_weight_kg: string;
  remaining_weight_kg: string;
  available_weight_kg: string;
  price_per_kg: string;
  status: CattleSaleStatus;
  target_reached_at: string | null;
  acceptance_due_at: string | null;
  accepted_at: string | null;
  fulfilment_due_at: string | null;
  slaughtered_at: string | null;
  processing_started_at: string | null;
  ready_for_fulfilment_at: string | null;
  fulfilled_at: string | null;
  sla_days: number | null;
  acceptance_overdue: boolean;
  fulfilment_overdue: boolean;
  fulfilment_seconds_remaining: number | null;
  permitted_actions: CattleFulfilmentAction[];
  reservation_summary: { total: number; unfulfilled: number };
  reservations: FarmerCattleReservation[];
  traceability: {
    id: number;
    from_status: string;
    stage: string;
    occurred_at: string;
    recorded_at: string;
    processor_name: string | null;
    batch_reference: string | null;
    notes: string | null;
    reservation_id: number | null;
    fulfilment_state: string | null;
  }[];
}
