<?php

use App\Http\Middleware\RequirePermission;
use App\Support\ApiResponse;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias(['permission' => RequirePermission::class]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
        $exceptions->render(function (Throwable $exception, Request $request): ?JsonResponse {
            if (! $request->is('api/*')) {
                return null;
            }
            if ($exception instanceof ValidationException) {
                return ApiResponse::error($exception->getMessage(), 422, errors: $exception->errors());
            }
            $status = $exception instanceof AuthenticationException ? 401
                : ($exception instanceof HttpExceptionInterface ? $exception->getStatusCode() : 500);
            $message = $status >= 500 ? 'An unexpected server error occurred. Please try again.'
                : ($exception->getMessage() ?: match ($status) {
                    401 => 'Please log in to continue.',
                    403 => 'You do not have permission to perform this action.',
                    404 => 'The requested resource was not found.',
                    default => 'The request could not be completed.',
                });
            $response = ApiResponse::error($message, $status);
            if ($exception instanceof HttpExceptionInterface) {
                $response->headers->add($exception->getHeaders());
            }

            return $response;
        });
    })->create();
