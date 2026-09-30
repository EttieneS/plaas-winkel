<?php

namespace App\Services;

use App\Models\Role;
use App\Models\User;
use App\Repositories\RoleRepository;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class RoleService
{
    public function __construct(private RoleRepository $roles) {}

    /** @return Collection<int, Role> */
    public function assignableRoles(User $actor): Collection
    {
        $permissions = $actor->permissionCodes();

        return $this->roles->all()->filter(
            fn (Role $role): bool => $role->permissions->pluck('code')->diff($permissions)->isEmpty()
        )->values();
    }

    public function validateAssignment(User $actor, array $roleIds): void
    {
        if (! $actor->hasPermission('roles.assign')) {
            throw new AuthorizationException('You do not have permission to assign roles.');
        }
        $roles = $this->roles->forAssignment($roleIds);
        if ($roles->count() !== count($roleIds)) {
            throw ValidationException::withMessages(['role_ids' => ['One or more selected roles no longer exist.']]);
        }
        $permissions = $actor->permissionCodes();
        foreach ($roles as $role) {
            if ($role->permissions->pluck('code')->diff($permissions)->isNotEmpty()) {
                throw new AuthorizationException('You cannot assign a role with permissions you do not hold.');
            }
        }
    }
}
