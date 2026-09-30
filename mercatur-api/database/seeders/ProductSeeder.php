<?php

namespace Database\Seeders;

use App\Models\Product;
use Illuminate\Database\Seeder;

class ProductSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        foreach (['cattle' => 'Cattle', 'cabbage' => 'Cabbage'] as $slug => $name) {
            Product::firstOrCreate(['slug' => $slug], ['name' => $name]);
        }
    }
}
