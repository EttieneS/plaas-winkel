<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'user_roles');
    }

    public function hasRole(string $code): bool
    {
        return $this->roles()->where('roles.code', $code)->exists();
    }

    public function hasPermission(string $code): bool
    {
        return $this->roles()->whereHas('permissions', fn (Builder $query): Builder => $query->where('permissions.code', $code))->exists();
    }

    /** @return list<string> */
    public function permissionCodes(): array
    {
        $this->loadMissing('roles.permissions');

        return $this->roles->flatMap(fn (Role $role) => $role->permissions->pluck('code'))
            ->unique()->sort()->values()->all();
    }

    public function authorizationData(): array
    {
        $this->loadMissing('roles.permissions');

        return array_merge($this->attributesToArray(), [
            'roles' => $this->roles->pluck('code')->sort()->values()->all(),
            'permissions' => $this->permissionCodes(),
        ]);
    }
}
