<?php

namespace App\Services;

use App\CattleListingStatus;
use App\Models\CattleListing;
use App\Models\User;
use App\Repositories\CattleListingRepository;
use Illuminate\Auth\Access\AuthorizationException;

class CattleListingService
{
    public function __construct(private CattleListingRepository $listings) {}

    public function create(User $actor, array $data): CattleListing
    {
        if (! $actor->hasPermission('cattle.create')) {
            throw new AuthorizationException('You do not have permission to create cattle listings.');
        }

        return $this->listings->create([
            'farmer_id' => $actor->id,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'carcass_weight_kg' => $data['carcass_weight_kg'],
            'price_per_kg' => $data['price_per_kg'],
            'status' => CattleListingStatus::Draft,
        ]);
    }
}
