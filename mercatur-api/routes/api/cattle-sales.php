<?php

use App\Http\Controllers\Api\CattleSaleCommitmentController;
use App\Http\Controllers\Api\CattleSaleController;
use App\Http\Controllers\Api\CattleSaleFulfilmentController;
use Illuminate\Support\Facades\Route;

Route::get('/cattle-sales/my-reservations', [CattleSaleCommitmentController::class, 'index'])
    ->middleware(['auth:sanctum', 'permission:cattle.reserve']);

Route::middleware(['auth:sanctum', 'permission:cattle.manage'])->prefix('cattle-sales/{cattleSale}/fulfilment')
    ->where(['cattleSale' => '[0-9]+'])->group(function (): void {
        Route::get('/', [CattleSaleFulfilmentController::class, 'show']);
        Route::post('/accept', [CattleSaleFulfilmentController::class, 'accept']);
        Route::post('/slaughter', [CattleSaleFulfilmentController::class, 'slaughter']);
        Route::post('/processing', [CattleSaleFulfilmentController::class, 'process']);
        Route::post('/ready', [CattleSaleFulfilmentController::class, 'ready']);
        Route::post('/reservations/{commitment}/collect', [CattleSaleFulfilmentController::class, 'collect'])->whereNumber('commitment');
        Route::post('/reservations/{commitment}/deliver', [CattleSaleFulfilmentController::class, 'deliver'])->whereNumber('commitment');
    });

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
