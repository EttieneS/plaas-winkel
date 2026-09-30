<?php

namespace App\Repositories;

use App\CattleSaleStatus;
use App\Models\CattleSale;
use Illuminate\Database\Eloquent\Collection;

class CattleSaleRepository
{
    /** @return Collection<int, CattleSale> */
    public function forOwner(int $ownerId): Collection
    {
        return CattleSale::query()->with('commitments')->where('owner_user_id', $ownerId)
            ->orderByDesc('id')->get();
    }

    public function create(array $attributes): CattleSale
    {
        return CattleSale::create($attributes)->refresh()->load('commitments');
    }

    /** @return Collection<int, CattleSale> */
    public function marketplace(): Collection
    {
        return CattleSale::query()->with('commitments')->where('status', CattleSaleStatus::Open->value)->orderByDesc('id')->get();
    }

    public function find(int $id): CattleSale
    {
        return CattleSale::query()->with('commitments')->findOrFail($id);
    }

    public function lock(int $id): CattleSale
    {
        return CattleSale::query()->lockForUpdate()->findOrFail($id)
            ->load(['commitments' => fn ($query) => $query->lockForUpdate()]);
    }

    public function markFullyCommitted(CattleSale $sale): void
    {
        $sale->update(['status' => CattleSaleStatus::FullyCommitted]);
    }

    public function refreshAllocation(CattleSale $sale): CattleSale
    {
        return $sale->refresh()->load('commitments');
    }
}
