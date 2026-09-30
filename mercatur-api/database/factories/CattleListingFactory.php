<?php

namespace Database\Factories;

use App\CattleListingStatus;
use App\Models\CattleListing;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<CattleListing> */
class CattleListingFactory extends Factory
{
    public function definition(): array
    {
        return [
            'farmer_id' => User::factory(),
            'title' => 'Beef carcass',
            'description' => null,
            'carcass_weight_kg' => '240.000',
            'price_per_kg' => '110.00',
            'status' => CattleListingStatus::Draft,
            'published_at' => null,
        ];
    }
}
