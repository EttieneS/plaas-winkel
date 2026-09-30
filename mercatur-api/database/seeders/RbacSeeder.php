<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RbacSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            $permissions = [
                'users.view' => 'View users',
                'users.create' => 'Create users',
                'users.edit' => 'Edit users',
                'users.delete' => 'Delete users',
                'roles.view' => 'View roles',
                'roles.assign' => 'Assign roles',
                'roles.create' => 'Create roles',
                'roles.edit' => 'Edit roles',
                'roles.delete' => 'Delete roles',
                'permissions.view' => 'View permissions',
                'permissions.assign' => 'Assign permissions',
                'cattle.create' => 'Create cattle listings',
                'cattle.view' => 'View cattle sales',
                'cattle.reserve' => 'Reserve cattle sale kilograms',
            ];
            $ids = [];
            foreach ($permissions as $code => $name) {
                $ids[$code] = Permission::updateOrCreate(['code' => $code], ['name' => $name])->id;
            }
            foreach (['BUYER' => 'Buyer', 'FARMER' => 'Farmer', 'ADMIN' => 'Administrator'] as $code => $name) {
                $role = Role::updateOrCreate(['code' => $code], ['name' => $name]);
                if ($code === 'ADMIN') {
                    $role->permissions()->syncWithoutDetaching(array_values($ids));
                }
                if ($code === 'FARMER') {
                    $role->permissions()->syncWithoutDetaching([$ids['cattle.create'], $ids['cattle.view']]);
                }
                if ($code === 'BUYER') {
                    $role->permissions()->syncWithoutDetaching([$ids['cattle.view'], $ids['cattle.reserve']]);
                }
            }
        });
    }
}
