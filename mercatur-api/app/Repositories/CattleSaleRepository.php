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

    public function markTargetReached(CattleSale $sale): void
    {
        $this->update($sale, ['status' => CattleSaleStatus::TargetReached, 'target_reached_at' => now()]);
        $this->recordEvent($sale, ['from_status' => CattleSaleStatus::Open->value,
            'to_status' => CattleSaleStatus::TargetReached->value, 'occurred_at' => $sale->target_reached_at]);
    }

    public function update(CattleSale $sale, array $attributes): void
    {
        $sale->update($attributes);
    }

    public function recordEvent(CattleSale $sale, array $attributes): void
    {
        $sale->events()->create($attributes);
    }

    public function details(CattleSale $sale): CattleSale
    {
        return $sale->refresh()->load(['commitments.buyer', 'events']);
    }

    public function refreshAllocation(CattleSale $sale): CattleSale
    {
        return $sale->refresh()->load('commitments');
    }
}
