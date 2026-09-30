<?php

namespace App\Services;

use App\CattleSaleCommitmentStatus;
use App\CattleSaleStatus;
use App\Models\User;
use App\Repositories\CattleSaleCommitmentRepository;
use App\Repositories\CattleSaleRepository;
use Brick\Math\BigDecimal;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class CattleSaleCommitmentService
{
    public function __construct(private CattleSaleCommitmentRepository $commitments,
        private CattleSaleRepository $sales) {}

    public function create(User $buyer, int $saleId, string $quantity): array
    {
        if (! $buyer->hasPermission('cattle.reserve')) {
            throw new AccessDeniedHttpException('You do not have permission to reserve cattle sale kilograms.');
        }
        $requested = BigDecimal::of($quantity);
        if ($requested->isLessThanOrEqualTo(0) || $requested->isGreaterThan('999999.999') || $requested->getScale() > 3) {
            throw ValidationException::withMessages(['quantity_kg' => ['Enter a positive quantity with up to three decimal places.']]);
        }

        return DB::transaction(function () use ($buyer, $saleId, $requested): array {
            $sale = $this->sales->lock($saleId);
            if ($sale->owner_user_id === $buyer->id) {
                throw new AccessDeniedHttpException('You cannot reserve kilograms from your own cattle sale.');
            }
            if ($sale->status !== CattleSaleStatus::Open) {
                throw new ConflictHttpException('This cattle sale is already fully committed.');
            }
            $remaining = BigDecimal::of($sale->remaining_weight_kg);
            if ($requested->isGreaterThan($remaining)) {
                throw ValidationException::withMessages(['quantity_kg' => ['Only '.(string) $remaining->strippedOfTrailingZeros().' kg remains available.']]);
            }
            $commitment = $this->commitments->create([
                'cattle_sale_id' => $sale->id,
                'buyer_user_id' => $buyer->id,
                'quantity_kg' => (string) $requested,
                'price_per_kg' => $sale->price_per_kg,
                'status' => CattleSaleCommitmentStatus::Confirmed,
            ]);
            if ($requested->isEqualTo($remaining)) {
                $this->sales->markFullyCommitted($sale);
            }

            return ['commitment' => $commitment, 'sale' => $this->sales->refreshAllocation($sale)];
        }, 5);
    }
}
