<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCattleListingRequest;
use App\Services\CattleListingService;
use Illuminate\Http\JsonResponse;

class CattleListingController extends Controller
{
    public function __construct(private CattleListingService $listings) {}

    public function store(StoreCattleListingRequest $request): JsonResponse
    {
        $listing = $this->listings->create($request->user(), $request->validated());

        return $this->success($listing, 'Cattle listing created successfully.', 201);
    }
}
