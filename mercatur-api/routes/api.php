<?php

use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(__DIR__.'/api/auth.php');
require __DIR__.'/api/products.php';
require __DIR__.'/api/sales.php';
require __DIR__.'/api/users.php';
require __DIR__.'/api/roles.php';
require __DIR__.'/api/cattle.php';
require __DIR__.'/api/cattle-sales.php';
