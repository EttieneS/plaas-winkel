<?php

namespace App\Repositories;

use App\Models\Product;
use Illuminate\Database\Eloquent\Collection;

class ProductRepository
{
    /** @return Collection<int, Product> */
    public function availableForSelling(): Collection
    {
        return Product::query()->where('is_active', true)->orderBy('name')
            ->get(['id', 'name', 'slug', 'description']);
    }
}
