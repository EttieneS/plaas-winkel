<?php

namespace App\Models;

use App\CattleSaleCommitmentStatus;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Database\Factories\CattleSaleCommitmentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['cattle_sale_id', 'buyer_user_id', 'quantity_kg', 'price_per_kg', 'status'])]
#[Hidden(['buyer_user_id'])]
class CattleSaleCommitment extends Model
{
    /** @use HasFactory<CattleSaleCommitmentFactory> */
    use HasFactory;

    protected $appends = ['total_amount'];

    protected function casts(): array
    {
        return ['quantity_kg' => 'decimal:3', 'price_per_kg' => 'decimal:2', 'status' => CattleSaleCommitmentStatus::class];
    }

    protected function totalAmount(): Attribute
    {
        return Attribute::get(fn (): string => (string) BigDecimal::of($this->quantity_kg)
            ->multipliedBy($this->price_per_kg)->toScale(2, RoundingMode::HalfUp));
    }

    public function cattleSale(): BelongsTo
    {
        return $this->belongsTo(CattleSale::class);
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_user_id');
    }
}
