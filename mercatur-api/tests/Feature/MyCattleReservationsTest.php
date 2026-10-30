<?php

namespace Tests\Feature;

use App\CattleReservationFulfilment;
use App\CattleSaleCommitmentStatus;
use App\CattleSaleStatus;
use App\Models\CattleSale;
use App\Models\CattleSaleCommitment;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RbacSeeder;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MyCattleReservationsTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function actor(string $role = 'BUYER'): User
    {
        $this->seed(RbacSeeder::class);
        $user = User::factory()->create();
        $user->roles()->attach(Role::where('code', $role)->firstOrFail());
        Sanctum::actingAs($user);

        return $user;
    }

    public function test_private_history_with_agreed_price_exact_total_progress_and_fulfilment(): void
    {
        $buyer = $this->actor();
        $sale = CattleSale::factory()->create(['estimated_weight_kg' => '20.000', 'price_per_kg' => '999.00',
            'status' => CattleSaleStatus::ReadyForFulfilment, 'ready_for_fulfilment_at' => now()]);
        $mine = CattleSaleCommitment::factory()->create(['cattle_sale_id' => $sale->id, 'buyer_user_id' => $buyer->id,
            'quantity_kg' => '0.125', 'price_per_kg' => '10.04', 'fulfilment_state' => CattleReservationFulfilment::Collected,
            'fulfilled_at' => now()]);
        CattleSaleCommitment::factory()->create(['cattle_sale_id' => $sale->id, 'quantity_kg' => '9.875']);
        $response = $this->getJson('/api/cattle-sales/my-reservations?buyer_user_id='.$sale->owner_user_id);
        $response->assertOk()->assertJsonPath('success', true)->assertJsonCount(1, 'data.reservations')
            ->assertJsonPath('data.reservations.0.id', $mine->id)
            ->assertJsonPath('data.reservations.0.quantity_kg', '0.125')
            ->assertJsonPath('data.reservations.0.price_per_kg', '10.04')
            ->assertJsonPath('data.reservations.0.total_amount', '1.26')
            ->assertJsonPath('data.reservations.0.fulfilment_state', 'COLLECTED')
            ->assertJsonPath('data.reservations.0.sale.committed_weight_kg', '10.000')
            ->assertJsonPath('data.reservations.0.sale.percentage_committed', 50)
            ->assertJsonPath('data.reservations.0.sale.status', 'READY_FOR_FULFILMENT')
            ->assertJsonMissingPath('data.reservations.0.buyer_user_id')
            ->assertJsonMissingPath('data.reservations.0.sale.owner_user_id')
            ->assertJsonMissingPath('data.reservations.0.sale.commitments')
            ->assertJsonMissingPath('data.reservations.0.sale.events');
        $this->assertNotNull($response->json('data.reservations.0.fulfilled_at'));
        $this->assertNotNull($response->json('data.reservations.0.sale.ready_for_fulfilment_at'));
    }

    public function test_pagination_keeps_pending_cancelled_and_completed_sale_history_newest_first(): void
    {
        $buyer = $this->actor();
        $sale = CattleSale::factory()->create(['status' => CattleSaleStatus::Fulfilled]);
        CattleSaleCommitment::factory()->count(24)->create(['buyer_user_id' => $buyer->id, 'cattle_sale_id' => $sale->id]);
        $pending = CattleSaleCommitment::factory()->create(['buyer_user_id' => $buyer->id, 'cattle_sale_id' => $sale->id,
            'status' => CattleSaleCommitmentStatus::Pending, 'created_at' => now()->addMinute()]);
        $cancelled = CattleSaleCommitment::factory()->create(['buyer_user_id' => $buyer->id, 'cattle_sale_id' => $sale->id,
            'status' => CattleSaleCommitmentStatus::Cancelled, 'created_at' => now()->addMinutes(2)]);
        $this->getJson('/api/cattle-sales/my-reservations')->assertOk()->assertJsonCount(25, 'data.reservations')
            ->assertJsonPath('data.pagination.total', 26)->assertJsonPath('data.pagination.last_page', 2)
            ->assertJsonPath('data.reservations.0.id', $cancelled->id)
            ->assertJsonPath('data.reservations.0.status', 'CANCELLED')
            ->assertJsonPath('data.reservations.1.id', $pending->id)
            ->assertJsonPath('data.reservations.1.status', 'PENDING');
        $this->getJson('/api/cattle-sales/my-reservations?page=2')->assertOk()->assertJsonCount(1, 'data.reservations');
    }

    public function test_authentication_permissions_revocation_and_empty_history(): void
    {
        $this->getJson('/api/cattle-sales/my-reservations')->assertUnauthorized()->assertJsonPath('success', false);
        $this->actor('FARMER');
        $this->getJson('/api/cattle-sales/my-reservations')->assertForbidden()->assertJsonPath('success', false);
        $this->actor('ADMIN');
        $this->getJson('/api/cattle-sales/my-reservations')->assertOk()->assertJsonCount(0, 'data.reservations');
        $buyer = $this->actor();
        $buyer->roles()->detach();
        $buyer->unsetRelation('roles');
        $this->getJson('/api/cattle-sales/my-reservations')->assertForbidden();
    }

    public function test_invalid_page_uses_standard_validation_envelope(): void
    {
        $this->actor();
        $this->getJson('/api/cattle-sales/my-reservations?page=0')->assertUnprocessable()
            ->assertJsonPath('success', false)->assertJsonValidationErrors('page');
    }
}
