<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $this->call(RbacSeeder::class);
        $this->call(ProductSeeder::class);

        if (! app()->environment(['local', 'testing'])) {
            return;
        }

        $user = User::firstOrCreate(
            ['email' => 'ettiene@mercatur.test'],
            ['name' => 'Ettiene', 'password' => '12345'],
        );
        $user->roles()->syncWithoutDetaching([Role::where('code', 'ADMIN')->firstOrFail()->id]);
    }
}
