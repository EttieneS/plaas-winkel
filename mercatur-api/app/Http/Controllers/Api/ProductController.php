<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ProductService;
use Illuminate\Http\JsonResponse;

class ProductController extends Controller
{
    public function __construct(private ProductService $products) {}

    public function index(): JsonResponse
    {
        return $this->success($this->products->availableForSelling());
    }
}
