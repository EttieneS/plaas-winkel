<?php

use App\Http\Controllers\Api\CattleListingController;
use Illuminate\Support\Facades\Route;

Route::post('/cattle', [CattleListingController::class, 'store'])
    ->middleware(['auth:sanctum', 'permission:cattle.create']);
