<?php

namespace App\Repositories;

use App\Models\CattleListing;

class CattleListingRepository
{
    public function create(array $attributes): CattleListing
    {
        return CattleListing::create($attributes)->refresh();
    }
}
