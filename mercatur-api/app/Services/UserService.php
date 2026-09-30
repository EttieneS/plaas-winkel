<?php

namespace App\Services;

use App\Models\User;
use App\Repositories\UserRepository;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UserService
{
    public function __construct(private UserRepository $users, private RoleService $roles) {}

    public function index(User $actor, int $page): LengthAwarePaginator
    {
        if (! $actor->hasPermission('users.view')) {
            throw new AuthorizationException('You do not have permission to view users.');
        }

        return $this->users->paginate($page);
    }

    public function create(User $actor, array $data): User
    {
        if (! $actor->hasPermission('users.create')) {
            throw new AuthorizationException('You do not have permission to create users.');
        }
        try {
            return DB::transaction(function () use ($actor, $data): User {
                $this->roles->validateAssignment($actor, $data['role_ids']);

                return $this->users->create(
                    ['name' => $data['name'], 'email' => $data['email'], 'password' => $data['password']],
                    $data['role_ids'],
                );
            });
        } catch (UniqueConstraintViolationException $exception) {
            throw ValidationException::withMessages(['email' => ['The email address is already registered.']]);
        }
    }
}
