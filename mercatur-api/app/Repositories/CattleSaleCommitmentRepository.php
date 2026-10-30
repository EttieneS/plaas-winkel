<?php

namespace App\Repositories;

use App\Models\CattleSaleCommitment;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class CattleSaleCommitmentRepository
{
    public function forBuyer(int $buyerId): LengthAwarePaginator
    {
        return CattleSaleCommitment::where('buyer_user_id', $buyerId)
            ->with('cattleSale.commitments')->orderByDesc('created_at')->orderByDesc('id')->paginate(25);
    }

    public function create(array $attributes): CattleSaleCommitment
    {
        return CattleSaleCommitment::create($attributes)->refresh();
    }

    public function update(CattleSaleCommitment $commitment, array $attributes): void
    {
        $commitment->update($attributes);
    }
}
