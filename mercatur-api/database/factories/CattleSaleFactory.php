<?php

namespace Database\Factories;

use App\CattleSaleStatus;
use App\Models\CattleSale;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<CattleSale>
 */
class CattleSaleFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'reference' => 'CS-'.Str::uuid(),
            'owner_user_id' => User::factory(),
            'estimated_weight_kg' => '250.125',
            'price_per_kg' => '110.50',
            'description' => null,
            'status' => CattleSaleStatus::Open,
        ];
    }
}
