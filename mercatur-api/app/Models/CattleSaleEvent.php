<?php

namespace App\Models;

use Database\Factories\CattleSaleEventFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['actor_user_id', 'cattle_sale_commitment_id', 'from_status', 'to_status', 'occurred_at',
    'processor_name', 'batch_reference', 'notes', 'fulfilment_state'])]
class CattleSaleEvent extends Model
{
    /** @use HasFactory<CattleSaleEventFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return ['occurred_at' => 'immutable_datetime'];
    }

    public function cattleSale(): BelongsTo
    {
        return $this->belongsTo(CattleSale::class);
    }
}
