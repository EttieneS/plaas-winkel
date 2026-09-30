<?php

namespace Tests\Feature;

use App\CattleListingStatus;
use App\Models\CattleListing;
use App\Models\Role;
use App\Models\User;
use App\Services\CattleListingService;
use Database\Seeders\RbacSeeder;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\TestWith;
use Tests\TestCase;

class CattleListingTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function actor(string $code = 'FARMER'): User
    {
        $this->seed(RbacSeeder::class);
        $user = User::factory()->create();
        $user->roles()->attach(Role::where('code', $code)->firstOrFail());

        return $user;
    }

    private function payload(): array
    {
        return [
            'title' => 'Beef carcass',
            'description' => 'Grass-fed beef',
            'carcass_weight_kg' => 240,
            'price_per_kg' => 110,
        ];
    }

    #[TestWith(['FARMER'])]
    #[TestWith(['ADMIN'])]
    public function test_authorized_creation_is_owned_by_the_actor_and_returns_a_normalized_draft(string $role): void
    {
        $actor = $this->actor($role);
        Sanctum::actingAs($actor);

        $response = $this->postJson('/api/cattle', $this->payload());

        $response->assertCreated()->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Cattle listing created successfully.')
            ->assertJsonPath('data.farmer_id', $actor->id)
            ->assertJsonPath('data.title', 'Beef carcass')
            ->assertJsonPath('data.carcass_weight_kg', '240.000')
            ->assertJsonPath('data.price_per_kg', '110.00')
            ->assertJsonPath('data.total_value', '26400.00')
            ->assertJsonPath('data.status', CattleListingStatus::Draft->value)
            ->assertJsonPath('data.published_at', null)
            ->assertJsonStructure(['success', 'message', 'data' => ['id', 'created_at', 'updated_at']]);
        $this->assertDatabaseHas('cattle_listings', [
            'id' => $response->json('data.id'), 'farmer_id' => $actor->id, 'status' => 'DRAFT',
        ]);
        $this->assertSame($actor->id, CattleListing::firstOrFail()->farmer->id);
        $this->assertCount(1, $actor->cattleListings);
    }

    public function test_authentication_is_required(): void
    {
        $this->postJson('/api/cattle', $this->payload())->assertUnauthorized()
            ->assertJsonPath('success', false)->assertJsonPath('data', null);
        $this->assertDatabaseCount('cattle_listings', 0);
    }

    public function test_buyer_without_permission_is_rejected(): void
    {
        Sanctum::actingAs($this->actor('BUYER'));
        $this->postJson('/api/cattle', $this->payload())->assertForbidden()
            ->assertJsonPath('success', false)->assertJsonPath('data', null);
        $this->assertDatabaseCount('cattle_listings', 0);
    }

    public function test_farmer_role_does_not_replace_permission_and_revocation_is_enforced(): void
    {
        $actor = $this->actor();
        $actor->roles()->firstOrFail()->permissions()->detach();
        Sanctum::actingAs($actor);

        $this->postJson('/api/cattle', $this->payload())->assertForbidden()
            ->assertJsonPath('message', 'You do not have permission to perform this action.');
        $this->assertDatabaseCount('cattle_listings', 0);
    }

    #[TestWith(['title', ''])]
    #[TestWith(['title', ' '])]
    #[TestWith(['carcass_weight_kg', null])]
    #[TestWith(['carcass_weight_kg', 0])]
    #[TestWith(['carcass_weight_kg', -1])]
    #[TestWith(['carcass_weight_kg', 'invalid'])]
    #[TestWith(['carcass_weight_kg', '0.0001'])]
    #[TestWith(['carcass_weight_kg', '1000000'])]
    #[TestWith(['price_per_kg', null])]
    #[TestWith(['price_per_kg', 0])]
    #[TestWith(['price_per_kg', -1])]
    #[TestWith(['price_per_kg', 'invalid'])]
    #[TestWith(['price_per_kg', '0.001'])]
    #[TestWith(['price_per_kg', '1000000'])]
    #[TestWith(['description', ['invalid']])]
    public function test_invalid_input_returns_normalized_field_errors_without_creating_a_listing(string $field, mixed $value): void
    {
        Sanctum::actingAs($this->actor());
        $payload = array_replace($this->payload(), [$field => $value]);

        $this->postJson('/api/cattle', $payload)->assertUnprocessable()
            ->assertJsonPath('success', false)->assertJsonPath('data', null)
            ->assertJsonValidationErrors($field)->assertJsonStructure(['message', 'errors']);
        $this->assertDatabaseCount('cattle_listings', 0);
    }

    #[TestWith(['farmer_id', 999])]
    #[TestWith(['farmer_id', null])]
    #[TestWith(['status', 'PUBLISHED'])]
    #[TestWith(['published_at', '2026-09-30'])]
    #[TestWith(['total_value', '1.00'])]
    public function test_client_cannot_supply_ownership_status_or_calculated_values(string $field, mixed $value): void
    {
        Sanctum::actingAs($this->actor());
        $this->postJson('/api/cattle', array_replace($this->payload(), [$field => $value]))
            ->assertUnprocessable()->assertJsonValidationErrors($field);
        $this->assertDatabaseCount('cattle_listings', 0);
    }

    #[TestWith(['240.125', '110.10', '26437.76'])]
    #[TestWith(['0.125', '0.04', '0.01'])]
    #[TestWith(['999999.999', '999999.99', '999999989000.00'])]
    public function test_total_uses_exact_decimal_multiplication_and_rounds_half_up(string $weight, string $price, string $total): void
    {
        Sanctum::actingAs($this->actor());
        $this->postJson('/api/cattle', array_replace($this->payload(), [
            'carcass_weight_kg' => $weight, 'price_per_kg' => $price,
        ]))->assertCreated()->assertJsonPath('data.total_value', $total);
    }

    public function test_description_is_optional_and_title_is_trimmed(): void
    {
        Sanctum::actingAs($this->actor());
        $payload = $this->payload();
        unset($payload['description']);
        $payload['title'] = '  Beef carcass  ';

        $this->postJson('/api/cattle', $payload)->assertCreated()
            ->assertJsonPath('data.description', null)->assertJsonPath('data.title', 'Beef carcass');
    }

    public function test_service_never_trusts_client_owner_or_status_even_outside_the_http_boundary(): void
    {
        $actor = $this->actor();
        $other = User::factory()->create();
        $listing = app(CattleListingService::class)->create($actor, array_replace($this->payload(), [
            'farmer_id' => $other->id, 'status' => 'PUBLISHED', 'published_at' => now(), 'total_value' => '1.00',
        ]));

        $this->assertSame($actor->id, $listing->farmer_id);
        $this->assertSame(CattleListingStatus::Draft, $listing->status);
        $this->assertNull($listing->published_at);
        $this->assertSame('26400.00', $listing->total_value);
    }

    public function test_reseeding_grants_cattle_creation_predictably_without_buyer_access(): void
    {
        $this->seed(RbacSeeder::class);
        $this->seed(RbacSeeder::class);
        foreach (['FARMER', 'ADMIN', 'BUYER'] as $code) {
            $user = User::factory()->create();
            $user->roles()->attach(Role::where('code', $code)->firstOrFail());
            $this->assertSame($code !== 'BUYER', $user->hasPermission('cattle.create'));
        }
    }
}
