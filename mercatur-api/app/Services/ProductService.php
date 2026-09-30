<?php

namespace App\Services;

use App\Models\Product;
use App\Repositories\ProductRepository;
use Illuminate\Database\Eloquent\Collection;

class ProductService
{
    public function __construct(private ProductRepository $products) {}

    /** @return Collection<int, Product> */
    public function availableForSelling(): Collection
    {
        return $this->products->availableForSelling();
    }
}
