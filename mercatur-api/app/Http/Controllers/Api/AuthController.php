<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function __construct(private AuthService $auth) {}

    public function login(LoginRequest $request): JsonResponse
    {
        $data = $request->validated();
        $user = $this->auth->authenticate($data['email'], $data['password']);
        if (! $user) {
            return $this->error('Invalid email or password.', 401);
        }

        return $this->success([
            'token' => $this->auth->token($user),
            'user' => $user->authorizationData(),
        ], 'Login successful.');
    }

    public function user(Request $request): JsonResponse
    {
        return $this->success($this->auth->currentUser($request->user())->authorizationData());
    }

    public function logout(Request $request): JsonResponse
    {
        $this->auth->logout($request->user());

        return $this->success(message: 'Logged out successfully.');
    }
}
