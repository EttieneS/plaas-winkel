<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\ProductSeeder;
use Database\Seeders\RbacSeeder;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\TestWith;
use Tests\TestCase;

class ProductTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function login(string $role): User
    {
        $this->seed(RbacSeeder::class);
        $user = User::factory()->create();
        $user->roles()->attach(Role::where('code', $role)->firstOrFail());
        Sanctum::actingAs($user);

        return $user;
    }

    #[TestWith(['FARMER'])]
    #[TestWith(['ADMIN'])]
    public function test_available_products_are_active_database_records(string $role): void
    {
        $this->login($role);
        $this->seed(ProductSeeder::class);
        Product::create(['name' => 'Apples', 'slug' => 'apples']);
        Product::create(['name' => 'Inactive', 'slug' => 'inactive', 'is_active' => false]);

        $this->getJson('/api/products?is_active=false')->assertOk()
            ->assertJsonPath('success', true)->assertJsonPath('message', 'OK')
            ->assertJsonCount(3, 'data')->assertJsonPath('data.0.slug', 'apples')
            ->assertJsonPath('data.1.slug', 'cabbage')->assertJsonPath('data.2.slug', 'cattle')
            ->assertJsonStructure(['data' => [['id', 'name', 'slug', 'description']]]);
    }

    public function test_authentication_and_permission_are_required(): void
    {
        $this->getJson('/api/products')->assertUnauthorized()->assertJsonPath('success', false);
        $this->login('BUYER');
        $this->getJson('/api/products')->assertForbidden()->assertJsonPath('success', false);
    }

    public function test_role_code_does_not_bypass_revoked_permission(): void
    {
        $user = $this->login('ADMIN');
        $user->roles()->firstOrFail()->permissions()->detach();
        $this->getJson('/api/products')->assertForbidden()->assertJsonPath('success', false);
    }

    public function test_empty_catalogue_returns_an_empty_array(): void
    {
        $this->login('FARMER');
        $this->getJson('/api/products')->assertOk()->assertExactJson([
            'success' => true, 'message' => 'OK', 'data' => [],
        ]);
    }

    public function test_seeding_is_repeatable_and_preserves_catalogue_edits(): void
    {
        $this->seed(ProductSeeder::class);
        $cattle = Product::where('slug', 'cattle')->firstOrFail();
        $cattle->update(['name' => 'Beef cattle', 'is_active' => false]);
        $this->seed(ProductSeeder::class);

        $this->assertDatabaseCount('products', 2);
        $this->assertDatabaseHas('products', ['id' => $cattle->id, 'slug' => 'cattle',
            'name' => 'Beef cattle', 'is_active' => false]);
        $this->assertDatabaseHas('products', ['slug' => 'cabbage', 'name' => 'Cabbage', 'is_active' => true]);
    }
}
