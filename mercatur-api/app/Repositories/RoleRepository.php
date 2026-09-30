<?php

namespace App\Repositories;

use App\Models\Role;
use Illuminate\Database\Eloquent\Collection;

class RoleRepository
{
    /** @return Collection<int, Role> */
    public function all(): Collection
    {
        return Role::with('permissions')->orderBy('name')->orderBy('id')->get();
    }

    /** @return Collection<int, Role> */
    public function forAssignment(array $ids): Collection
    {
        return Role::with('permissions')->whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get();
    }
}
