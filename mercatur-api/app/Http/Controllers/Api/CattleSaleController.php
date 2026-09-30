<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCattleSaleRequest;
use App\Http\Resources\CattleSaleResource;
use App\Services\CattleSaleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CattleSaleController extends Controller
{
    public function __construct(private CattleSaleService $sales) {}

    public function index(Request $request): JsonResponse
    {
        return $this->success($this->sales->forOwner($request->user()));
    }

    public function marketplace(Request $request): JsonResponse
    {
        return $this->success(CattleSaleResource::collection($this->sales->marketplace($request->user()))->resolve($request));
    }

    public function show(Request $request, int $cattleSale): JsonResponse
    {
        return $this->success(new CattleSaleResource($this->sales->view($request->user(), $cattleSale)));
    }

    public function store(StoreCattleSaleRequest $request): JsonResponse
    {
        return $this->success($this->sales->create($request->user(), $request->validated()),
            'Cattle sale created successfully.', 201);
    }
}
