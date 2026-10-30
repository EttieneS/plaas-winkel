<?php

namespace App\Models;

use App\CattleSaleCommitmentStatus;
use App\CattleSaleStatus;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Database\Factories\CattleSaleFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['reference', 'owner_user_id', 'estimated_weight_kg', 'price_per_kg',
    'description', 'status', 'target_reached_at', 'accepted_at', 'sla_days', 'fulfilment_due_at',
    'slaughtered_at', 'processing_started_at', 'ready_for_fulfilment_at', 'fulfilled_at'])]
#[Hidden(['commitments'])]
class CattleSale extends Model
{
    /** @use HasFactory<CattleSaleFactory> */
    use HasFactory;

    protected $appends = ['committed_weight_kg', 'remaining_weight_kg', 'available_weight_kg', 'percentage_committed'];

    protected function casts(): array
    {
        return [
            'estimated_weight_kg' => 'decimal:3',
            'price_per_kg' => 'decimal:2',
            'status' => CattleSaleStatus::class,
            'target_reached_at' => 'immutable_datetime',
            'accepted_at' => 'immutable_datetime',
            'fulfilment_due_at' => 'immutable_datetime',
            'slaughtered_at' => 'immutable_datetime',
            'processing_started_at' => 'immutable_datetime',
            'ready_for_fulfilment_at' => 'immutable_datetime',
            'fulfilled_at' => 'immutable_datetime',
            'sla_days' => 'integer',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function commitments(): HasMany
    {
        return $this->hasMany(CattleSaleCommitment::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(CattleSaleEvent::class)->orderBy('id');
    }

    protected function committedWeightKg(): Attribute
    {
        return Attribute::get(function (): string {
            $total = BigDecimal::zero();
            foreach ($this->commitments as $commitment) {
                if ($commitment->status === CattleSaleCommitmentStatus::Confirmed) {
                    $total = $total->plus($commitment->quantity_kg);
                }
            }

            return (string) $total->toScale(3);
        });
    }

    protected function remainingWeightKg(): Attribute
    {
        return Attribute::get(fn (): string => (string) BigDecimal::of($this->estimated_weight_kg)
            ->minus($this->committed_weight_kg)->toScale(3));
    }

    protected function availableWeightKg(): Attribute
    {
        return Attribute::get(fn (): string => $this->remaining_weight_kg);
    }

    protected function percentageCommitted(): Attribute
    {
        return Attribute::get(fn (): float => BigDecimal::of($this->committed_weight_kg)
            ->multipliedBy(100)->dividedBy($this->estimated_weight_kg, 2, RoundingMode::HalfUp)->toFloat());
    }
}
