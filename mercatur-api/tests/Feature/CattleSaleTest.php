<?php

namespace Tests\Feature;

use App\Models\CattleSale;
use App\Models\Role;
use App\Models\User;
use App\Services\CattleSaleService;
use Database\Seeders\RbacSeeder;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\TestWith;
use Tests\TestCase;

class CattleSaleTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function actor(string $role = 'FARMER'): User
    {
        $this->seed(RbacSeeder::class);
        $actor = User::factory()->create();
        $actor->roles()->attach(Role::where('code', $role)->firstOrFail());
        Sanctum::actingAs($actor);

        return $actor;
    }

    private function payload(): array
    {
        return ['estimated_weight_kg' => '250.125', 'price_per_kg' => '110.50', 'description' => 'Estimated sellable beef'];
    }

    #[TestWith(['FARMER'])]
    #[TestWith(['ADMIN'])]
    public function test_actor_can_create_an_owned_open_sale_with_exact_decimal_weights(string $role): void
    {
        $actor = $this->actor($role);
        $response = $this->postJson('/api/cattle-sales', $this->payload());
        $response->assertCreated()->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Cattle sale created successfully.')
            ->assertJsonPath('data.owner_user_id', $actor->id)
            ->assertJsonPath('data.estimated_weight_kg', '250.125')
            ->assertJsonPath('data.available_weight_kg', '250.125')
            ->assertJsonPath('data.price_per_kg', '110.50')->assertJsonPath('data.status', 'OPEN');
        $this->assertMatchesRegularExpression('/^CS-[0-9a-f-]{36}$/', $response->json('data.reference'));
        $sale = CattleSale::firstOrFail();
        $this->assertSame($actor->id, $sale->owner->id);
        $this->assertCount(1, $actor->cattleSales);
        $other = $this->postJson('/api/cattle-sales', $this->payload())->assertCreated();
        $this->assertNotSame($response->json('data.reference'), $other->json('data.reference'));
    }

    #[TestWith(['estimated_weight_kg', 0])]
    #[TestWith(['estimated_weight_kg', -1])]
    #[TestWith(['estimated_weight_kg', null])]
    #[TestWith(['estimated_weight_kg', '0.0001'])]
    #[TestWith(['estimated_weight_kg', '1000000'])]
    #[TestWith(['estimated_weight_kg', 'invalid'])]
    #[TestWith(['price_per_kg', 0])]
    #[TestWith(['price_per_kg', -1])]
    #[TestWith(['price_per_kg', null])]
    #[TestWith(['price_per_kg', '0.001'])]
    #[TestWith(['price_per_kg', '1000000'])]
    #[TestWith(['description', ['invalid']])]
    public function test_invalid_values_are_rejected(string $field, mixed $value): void
    {
        $this->actor();
        $this->postJson('/api/cattle-sales', array_replace($this->payload(), [$field => $value]))
            ->assertUnprocessable()->assertJsonPath('success', false)->assertJsonValidationErrors($field);
        $this->assertDatabaseCount('cattle_sales', 0);
    }

    #[TestWith(['owner_user_id', 999])]
    #[TestWith(['farmer_id', 999])]
    #[TestWith(['reference', 'CLIENT'])]
    #[TestWith(['available_weight_kg', '1.000'])]
    #[TestWith(['status', 'CLOSED'])]
    public function test_client_cannot_supply_server_controlled_fields(string $field, mixed $value): void
    {
        $this->actor();
        $this->postJson('/api/cattle-sales', array_replace($this->payload(), [$field => $value]))
            ->assertUnprocessable()->assertJsonValidationErrors($field);
        $this->assertDatabaseCount('cattle_sales', 0);
    }

    #[TestWith(['FARMER'])]
    #[TestWith(['ADMIN'])]
    public function test_listing_is_scoped_to_authenticated_owner_even_with_owner_query(string $role): void
    {
        $actor = $this->actor($role);
        $mine = CattleSale::factory()->create(['owner_user_id' => $actor->id]);
        $other = CattleSale::factory()->create();
        $this->getJson('/api/cattle-sales?owner_user_id='.$other->owner_user_id)
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $mine->id);
    }

    public function test_service_does_not_trust_client_owner_reference_or_availability(): void
    {
        $actor = $this->actor();
        $sale = app(CattleSaleService::class)->create($actor, array_replace($this->payload(), [
            'owner_user_id' => 999, 'reference' => 'CLIENT', 'available_weight_kg' => 1, 'status' => 'CLOSED',
        ]));
        $this->assertSame($actor->id, $sale->owner_user_id);
        $this->assertSame('250.125', $sale->available_weight_kg);
        $this->assertSame('OPEN', $sale->status->value);
        $this->assertNotSame('CLIENT', $sale->reference);
    }

    public function test_authentication_permission_and_revocation_are_enforced(): void
    {
        $this->getJson('/api/cattle-sales')->assertUnauthorized()->assertJsonPath('success', false);
        $this->postJson('/api/cattle-sales', $this->payload())->assertUnauthorized();
        $this->actor('BUYER');
        $this->getJson('/api/cattle-sales')->assertForbidden();
        $this->postJson('/api/cattle-sales', $this->payload())->assertForbidden();
        $actor = $this->actor('FARMER');
        $actor->roles()->firstOrFail()->permissions()->detach();
        $this->getJson('/api/cattle-sales')->assertForbidden();
        $this->postJson('/api/cattle-sales', $this->payload())->assertForbidden();
    }

    public function test_empty_list_and_optional_description(): void
    {
        $this->actor();
        $this->getJson('/api/cattle-sales')->assertOk()->assertJsonPath('data', []);
        $this->postJson('/api/cattle-sales', ['estimated_weight_kg' => 10, 'price_per_kg' => 2])
            ->assertCreated()->assertJsonPath('data.description', null);
    }
}
