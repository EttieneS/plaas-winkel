<?php

namespace App\Repositories;

use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Laravel\Sanctum\PersonalAccessToken;

class UserRepository
{
    public function findByEmail(string $email): ?User
    {
        return User::where('email', $email)->first();
    }

    public function paginate(int $page): LengthAwarePaginator
    {
        return User::with('roles.permissions')->orderBy('id')->paginate(25, ['*'], 'page', $page);
    }

    public function create(array $attributes, array $roleIds): User
    {
        $user = User::create($attributes);
        $user->roles()->attach($roleIds);

        return $user->load('roles.permissions');
    }

    public function withAuthorization(User $user): User
    {
        return $user->load('roles.permissions');
    }

    public function issueToken(User $user): string
    {
        return $user->createToken('mercatur')->plainTextToken;
    }

    public function revokeCurrentToken(User $user): void
    {
        $token = $user->currentAccessToken();
        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }
    }
}
