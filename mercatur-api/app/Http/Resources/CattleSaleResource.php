<?php

namespace App\Http\Resources;

use App\CattleSaleStatus;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CattleSaleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id, 'reference' => $this->reference,
            'estimated_weight_kg' => $this->estimated_weight_kg,
            'committed_weight_kg' => $this->committed_weight_kg,
            'remaining_weight_kg' => $this->remaining_weight_kg,
            'available_weight_kg' => $this->remaining_weight_kg,
            'percentage_committed' => $this->percentage_committed,
            'price_per_kg' => $this->price_per_kg, 'status' => $this->status->value,
            'description' => $this->description, 'created_at' => $this->created_at,
            'can_reserve' => $request->user()?->hasPermission('cattle.reserve')
                && $request->user()->id !== $this->owner_user_id && $this->status === CattleSaleStatus::Open,
        ];
    }
}
