<?php

use App\Http\Controllers\Api\RoleController;
use Illuminate\Support\Facades\Route;

Route::get('/roles', [RoleController::class, 'index'])
    ->middleware(['auth:sanctum', 'permission:roles.view,roles.assign']);
