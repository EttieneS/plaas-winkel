<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCattleSaleCommitmentRequest;
use App\Http\Resources\CattleSaleCommitmentResource;
use App\Http\Resources\CattleSaleResource;
use App\Services\CattleSaleCommitmentService;
use Brick\Math\BigDecimal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CattleSaleCommitmentController extends Controller
{
    public function __construct(private CattleSaleCommitmentService $commitments) {}

    public function store(StoreCattleSaleCommitmentRequest $request, int $cattleSale): JsonResponse
    {
        $result = $this->commitments->create($request->user(), $cattleSale, (string) $request->validated('quantity_kg'));

        return $this->success(['commitment' => $result['commitment'], 'sale' => new CattleSaleResource($result['sale'])],
            BigDecimal::of($result['commitment']->quantity_kg)->strippedOfTrailingZeros().' kg reserved successfully.', 201);
    }

    public function index(Request $request): JsonResponse
    {
        $request->validate(['page' => ['sometimes', 'integer', 'min:1']]);
        $reservations = $this->commitments->forBuyer($request->user());

        return $this->success([
            'reservations' => CattleSaleCommitmentResource::collection($reservations->getCollection()),
            'pagination' => [
                'current_page' => $reservations->currentPage(),
                'last_page' => $reservations->lastPage(),
                'per_page' => $reservations->perPage(),
                'total' => $reservations->total(),
            ],
        ]);
    }
}
