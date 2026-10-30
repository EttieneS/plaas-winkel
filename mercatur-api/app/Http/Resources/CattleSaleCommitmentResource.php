<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CattleSaleCommitmentResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'quantity_kg' => $this->quantity_kg,
            'price_per_kg' => $this->price_per_kg,
            'total_amount' => $this->total_amount,
            'status' => $this->status->value,
            'fulfilment_state' => $this->fulfilment_state->value,
            'fulfilled_at' => $this->fulfilled_at?->toISOString(),
            'created_at' => $this->created_at->toISOString(),
            'sale' => [
                'id' => $this->cattleSale->id,
                'reference' => $this->cattleSale->reference,
                'status' => $this->cattleSale->status->value,
                'estimated_weight_kg' => $this->cattleSale->estimated_weight_kg,
                'committed_weight_kg' => $this->cattleSale->committed_weight_kg,
                'percentage_committed' => $this->cattleSale->percentage_committed,
                'fulfilment_due_at' => $this->cattleSale->fulfilment_due_at?->toISOString(),
                'ready_for_fulfilment_at' => $this->cattleSale->ready_for_fulfilment_at?->toISOString(),
            ],
        ];
    }
}
