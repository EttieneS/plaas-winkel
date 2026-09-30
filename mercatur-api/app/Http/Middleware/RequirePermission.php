<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequirePermission
{
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $user = $request->user();
        if (! $user) {
            throw new AuthenticationException;
        }
        foreach ($permissions as $permission) {
            if (! $user->hasPermission($permission)) {
                throw new AuthorizationException('You do not have permission to perform this action.');
            }
        }

        return $next($request);
    }
}
