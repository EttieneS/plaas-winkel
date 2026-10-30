<?php

namespace Database\Factories;

use App\Models\CattleSale;
use App\Models\CattleSaleEvent;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CattleSaleEvent>
 */
class CattleSaleEventFactory extends Factory
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
            'from_status' => 'OPEN',
            'to_status' => 'TARGET_REACHED',
            'occurred_at' => now(),
        ];
    }
}
