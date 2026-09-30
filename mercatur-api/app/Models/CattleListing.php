<?php

namespace App\Models;

use App\CattleListingStatus;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Database\Factories\CattleListingFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['farmer_id', 'title', 'description', 'carcass_weight_kg', 'price_per_kg', 'status'])]
class CattleListing extends Model
{
    /** @use HasFactory<CattleListingFactory> */
    use HasFactory;

    protected $appends = ['total_value'];

    protected function casts(): array
    {
        return [
            'carcass_weight_kg' => 'decimal:3',
            'price_per_kg' => 'decimal:2',
            'status' => CattleListingStatus::class,
            'published_at' => 'datetime',
        ];
    }

    public function farmer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'farmer_id');
    }

    /** The derived value uses exact decimals and rounds half up to rand cents. */
    protected function totalValue(): Attribute
    {
        return Attribute::get(fn (): string => (string) BigDecimal::of($this->carcass_weight_kg)
            ->multipliedBy($this->price_per_kg)->toScale(2, RoundingMode::HalfUp));
    }
}
