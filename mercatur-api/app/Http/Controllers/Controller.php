<?php

namespace App\Http\Controllers;

use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

abstract class Controller
{
    protected function success(mixed $data = null, string $message = 'OK', int $status = 200): JsonResponse
    {
        return ApiResponse::success($data, $message, $status);
    }

    protected function error(string $message, int $status = 400, mixed $data = null, ?array $errors = null): JsonResponse
    {
        return ApiResponse::error($message, $status, $data, $errors);
    }
}
