<?php

use App\Http\Controllers\Api\CattleSaleCommitmentController;
use App\Http\Controllers\Api\CattleSaleController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'permission:cattle.create'])->group(function (): void {
    Route::get('/cattle-sales', [CattleSaleController::class, 'index']);
    Route::post('/cattle-sales', [CattleSaleController::class, 'store']);
});

Route::middleware(['auth:sanctum', 'permission:cattle.view'])->group(function (): void {
    Route::get('/cattle-sales/marketplace', [CattleSaleController::class, 'marketplace']);
    Route::get('/cattle-sales/{cattleSale}', [CattleSaleController::class, 'show'])->whereNumber('cattleSale');
});
Route::post('/cattle-sales/{cattleSale}/commitments', [CattleSaleCommitmentController::class, 'store'])
    ->whereNumber('cattleSale')->middleware(['auth:sanctum', 'permission:cattle.reserve']);
