<?php

namespace App\Services;

use App\CattleSaleStatus;
use App\Models\CattleSale;
use App\Models\User;
use App\Repositories\CattleSaleRepository;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Str;

class CattleSaleService
{
    public function __construct(private CattleSaleRepository $sales) {}

    /** @return Collection<int, CattleSale> */
    public function forOwner(User $actor): Collection
    {
        $this->authorize($actor);

        return $this->sales->forOwner($actor->id);
    }

    public function create(User $actor, array $data): CattleSale
    {
        $this->authorize($actor);

        return $this->sales->create([
            'reference' => 'CS-'.Str::uuid(),
            'owner_user_id' => $actor->id,
            'estimated_weight_kg' => $data['estimated_weight_kg'],
            'price_per_kg' => $data['price_per_kg'],
            'description' => $data['description'] ?? null,
            'status' => CattleSaleStatus::Open,
        ]);
    }

    private function authorize(User $actor): void
    {
        if (! $actor->hasPermission('cattle.create')) {
            throw new AuthorizationException('You do not have permission to manage cattle sales.');
        }
    }

    /** @return Collection<int, CattleSale> */
    public function marketplace(User $actor): Collection
    {
        $this->authorizeViewing($actor);

        return $this->sales->marketplace();
    }

    public function view(User $actor, int $id): CattleSale
    {
        $this->authorizeViewing($actor);

        return $this->sales->find($id);
    }

    private function authorizeViewing(User $actor): void
    {
        if (! $actor->hasPermission('cattle.view')) {
            throw new AuthorizationException('You do not have permission to view cattle sales.');
        }
    }
}
