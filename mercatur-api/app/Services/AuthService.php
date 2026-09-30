<?php

namespace App\Services;

use App\Models\User;
use App\Repositories\UserRepository;
use Illuminate\Support\Facades\Hash;

class AuthService
{
    public function __construct(private UserRepository $users) {}

    public function authenticate(string $email, string $password): ?User
    {
        $user = $this->users->findByEmail($email);
        if (! $user || ! Hash::check($password, $user->password)) {
            return null;
        }

        return $this->users->withAuthorization($user);
    }

    public function token(User $user): string
    {
        return $this->users->issueToken($user);
    }

    public function currentUser(User $user): User
    {
        return $this->users->withAuthorization($user);
    }

    public function logout(User $user): void
    {
        $this->users->revokeCurrentToken($user);
    }
}
