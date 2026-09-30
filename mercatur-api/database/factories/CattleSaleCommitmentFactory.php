<?php

namespace Database\Factories;

use App\CattleSaleCommitmentStatus;
use App\Models\CattleSale;
use App\Models\CattleSaleCommitment;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CattleSaleCommitment>
 */
class CattleSaleCommitmentFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'cattle_sale_id' => CattleSale::factory(),
            'buyer_user_id' => User::factory(),
            'quantity_kg' => '10.000',
            'price_per_kg' => '120.00',
            'status' => CattleSaleCommitmentStatus::Confirmed,
        ];
    }
}
