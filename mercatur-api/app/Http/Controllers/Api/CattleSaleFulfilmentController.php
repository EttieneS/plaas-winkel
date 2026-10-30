<?php

namespace App\Http\Controllers\Api;

use App\CattleReservationFulfilment;
use App\Http\Controllers\Controller;
use App\Http\Requests\CattleSaleStageRequest;
use App\Services\CattleSaleFulfilmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CattleSaleFulfilmentController extends Controller
{
    public function __construct(private CattleSaleFulfilmentService $fulfilment) {}

    public function show(Request $request, int $cattleSale): JsonResponse
    {
        return $this->success($this->fulfilment->view($request->user(), $cattleSale));
    }

    public function accept(Request $request, int $cattleSale): JsonResponse
    {
        return $this->success($this->fulfilment->accept($request->user(), $cattleSale), 'Cattle sale accepted. Your fulfilment SLA has started.');
    }

    public function slaughter(CattleSaleStageRequest $request, int $cattleSale): JsonResponse
    {
        return $this->success($this->fulfilment->slaughter($request->user(), $cattleSale, $request->validated()), 'Slaughter recorded successfully.');
    }

    public function process(CattleSaleStageRequest $request, int $cattleSale): JsonResponse
    {
        return $this->success($this->fulfilment->process($request->user(), $cattleSale, $request->validated()), 'Processing recorded successfully.');
    }

    public function ready(Request $request, int $cattleSale): JsonResponse
    {
        return $this->success($this->fulfilment->ready($request->user(), $cattleSale), 'Meat is ready for fulfilment. The farmer SLA is satisfied.');
    }

    public function collect(Request $request, int $cattleSale, int $commitment): JsonResponse
    {
        return $this->success($this->fulfilment->fulfilReservation($request->user(), $cattleSale, $commitment,
            CattleReservationFulfilment::Collected), 'Reservation marked collected.');
    }

    public function deliver(Request $request, int $cattleSale, int $commitment): JsonResponse
    {
        return $this->success($this->fulfilment->fulfilReservation($request->user(), $cattleSale, $commitment,
            CattleReservationFulfilment::Delivered), 'Reservation marked delivered.');
    }
}
