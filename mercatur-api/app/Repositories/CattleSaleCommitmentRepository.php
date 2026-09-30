<?php

namespace App\Repositories;

use App\Models\CattleSaleCommitment;

class CattleSaleCommitmentRepository
{
    public function create(array $attributes): CattleSaleCommitment
    {
        return CattleSaleCommitment::create($attributes)->refresh();
    }
}
