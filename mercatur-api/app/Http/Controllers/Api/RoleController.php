<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Services\RoleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoleController extends Controller
{
    public function __construct(private RoleService $roles) {}

    public function index(Request $request): JsonResponse
    {
        return $this->success($this->roles->assignableRoles($request->user())->map(
            fn (Role $role): array => ['id' => $role->id, 'name' => $role->name, 'code' => $role->code]
        )->all());
    }
}
