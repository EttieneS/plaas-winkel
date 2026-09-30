<?php

namespace Tests\Feature;

use App\CattleSaleCommitmentStatus;
use App\CattleSaleStatus;
use App\Models\CattleSale;
use App\Models\CattleSaleCommitment;
use App\Models\Role;
use App\Models\User;
use App\Repositories\CattleSaleRepository;
use App\Services\CattleSaleCommitmentService;
use Brick\Math\BigDecimal;
use Database\Seeders\RbacSeeder;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\TestWith;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Tests\TestCase;

class CattleSaleCommitmentTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function buyer(string $role = 'BUYER'): User
    {
        $this->seed(RbacSeeder::class);
        $user = User::factory()->create();
        $user->roles()->attach(Role::where('code', $role)->firstOrFail());
        Sanctum::actingAs($user);

        return $user;
    }

    private function sale(): CattleSale
    {
        return CattleSale::factory()->create(['estimated_weight_kg' => '250.000', 'price_per_kg' => '120.00']);
    }

    private function url(CattleSale $sale): string
    {
        return '/api/cattle-sales/'.$sale->id.'/commitments';
    }

    public function test_buyer_reserves_with_authenticated_ownership_sale_price_exact_total_and_private_response(): void
    {
        $buyer = $this->buyer();
        $sale = $this->sale();
        $response = $this->postJson($this->url($sale), ['quantity_kg' => 10]);
        $response->assertCreated()->assertJsonPath('success', true)
            ->assertJsonPath('message', '10 kg reserved successfully.')
            ->assertJsonPath('data.commitment.quantity_kg', '10.000')
            ->assertJsonPath('data.commitment.price_per_kg', '120.00')
            ->assertJsonPath('data.commitment.total_amount', '1200.00')
            ->assertJsonPath('data.commitment.status', 'CONFIRMED')
            ->assertJsonPath('data.sale.committed_weight_kg', '10.000')
            ->assertJsonPath('data.sale.remaining_weight_kg', '240.000')
            ->assertJsonPath('data.sale.available_weight_kg', '240.000')
            ->assertJsonPath('data.sale.percentage_committed', 4)
            ->assertJsonMissingPath('data.commitment.buyer_user_id')
            ->assertJsonMissingPath('data.sale.owner_user_id')->assertJsonMissingPath('data.sale.commitments');
        $this->assertDatabaseHas('cattle_sale_commitments', ['buyer_user_id' => $buyer->id, 'cattle_sale_id' => $sale->id]);
        $this->assertFalse(Schema::hasColumn('cattle_sales', 'available_weight_kg'));
        $this->assertFalse(Schema::hasColumn('cattle_sale_commitments', 'total_amount'));
        $this->assertSame($buyer->id, CattleSaleCommitment::firstOrFail()->buyer->id);
        $this->assertCount(1, $buyer->cattleSaleCommitments);
    }

    #[TestWith([0])]
    #[TestWith([-1])]
    #[TestWith([null])]
    #[TestWith(['invalid'])]
    #[TestWith(['0.0001'])]
    #[TestWith(['1000000'])]
    public function test_invalid_quantities_are_rejected(mixed $quantity): void
    {
        $this->buyer();
        $this->postJson($this->url($this->sale()), ['quantity_kg' => $quantity])
            ->assertUnprocessable()->assertJsonValidationErrors('quantity_kg');
        $this->assertDatabaseCount('cattle_sale_commitments', 0);
    }

    #[TestWith(['price_per_kg', 1])]
    #[TestWith(['buyer_user_id', 999])]
    #[TestWith(['total_amount', 1])]
    #[TestWith(['status', 'PENDING'])]
    #[TestWith(['cattle_sale_id', 999])]
    #[TestWith(['remaining_weight_kg', 500])]
    #[TestWith(['available_weight_kg', 500])]
    #[TestWith(['committed_weight_kg', 0])]
    #[TestWith(['estimated_weight_kg', 500])]
    #[TestWith(['percentage_committed', 0])]
    public function test_frontend_cannot_override_server_controlled_fields(string $field, mixed $value): void
    {
        $this->buyer();
        $this->postJson($this->url($this->sale()), ['quantity_kg' => 10, $field => $value])
            ->assertUnprocessable()->assertJsonValidationErrors($field);
        $this->assertDatabaseCount('cattle_sale_commitments', 0);
    }

    public function test_only_confirmed_commitments_count_and_percentage_is_decimal_safe(): void
    {
        $this->buyer();
        $sale = $this->sale();
        CattleSaleCommitment::factory()->create(['cattle_sale_id' => $sale->id, 'quantity_kg' => '85.000']);
        CattleSaleCommitment::factory()->create(['cattle_sale_id' => $sale->id, 'quantity_kg' => '100.000', 'status' => CattleSaleCommitmentStatus::Cancelled]);
        CattleSaleCommitment::factory()->create(['cattle_sale_id' => $sale->id, 'quantity_kg' => '100.000', 'status' => CattleSaleCommitmentStatus::Pending]);
        $this->getJson('/api/cattle-sales/'.$sale->id)->assertOk()
            ->assertJsonPath('data.committed_weight_kg', '85.000')->assertJsonPath('data.remaining_weight_kg', '165.000')
            ->assertJsonPath('data.available_weight_kg', '165.000')->assertJsonPath('data.percentage_committed', 34);
    }

    public function test_oversell_boundary_rejects_eleven_allows_ten_then_rejects_further_requests(): void
    {
        $this->buyer();
        $sale = $this->sale();
        CattleSaleCommitment::factory()->create(['cattle_sale_id' => $sale->id, 'quantity_kg' => '240.000']);
        $this->postJson($this->url($sale), ['quantity_kg' => 11])->assertUnprocessable()
            ->assertJsonPath('errors.quantity_kg.0', 'Only 10 kg remains available.');
        $this->assertDatabaseCount('cattle_sale_commitments', 1);
        $this->postJson($this->url($sale), ['quantity_kg' => 10])->assertCreated()
            ->assertJsonPath('data.sale.status', 'FULLY_COMMITTED')->assertJsonPath('data.sale.remaining_weight_kg', '0.000')
            ->assertJsonPath('data.sale.percentage_committed', 100)->assertJsonPath('data.sale.can_reserve', false);
        $this->postJson($this->url($sale), ['quantity_kg' => 1])->assertConflict()
            ->assertJsonPath('message', 'This cattle sale is already fully committed.');
        $this->assertDatabaseCount('cattle_sale_commitments', 2);
    }

    #[TestWith(['7.5'])]
    #[TestWith(['12.25'])]
    #[TestWith(['0.5'])]
    public function test_decimal_quantities_can_fill_remaining_capacity_exactly(string $remaining): void
    {
        $this->buyer();
        $sale = $this->sale();
        $already = BigDecimal::of('250')->minus($remaining);
        CattleSaleCommitment::factory()->create(['cattle_sale_id' => $sale->id, 'quantity_kg' => (string) $already]);
        $this->postJson($this->url($sale), ['quantity_kg' => $remaining])->assertCreated()
            ->assertJsonPath('data.sale.remaining_weight_kg', '0.000')->assertJsonPath('data.sale.status', 'FULLY_COMMITTED');
    }

    public function test_decimal_sum_and_total_rounding_do_not_use_binary_float(): void
    {
        $this->buyer();
        $sale = CattleSale::factory()->create(['estimated_weight_kg' => '0.300', 'price_per_kg' => '0.05']);
        $this->postJson($this->url($sale), ['quantity_kg' => '0.1'])->assertCreated()->assertJsonPath('data.commitment.total_amount', '0.01');
        $this->postJson($this->url($sale), ['quantity_kg' => '0.2'])->assertCreated()
            ->assertJsonPath('data.sale.committed_weight_kg', '0.300')->assertJsonPath('data.sale.remaining_weight_kg', '0.000');
    }

    #[TestWith(['ADMIN'])]
    #[TestWith(['FARMER'])]
    public function test_owner_cannot_reserve_even_with_reserve_permission(string $role): void
    {
        $owner = $this->buyer($role);
        if ($role === 'FARMER') {
            $owner->roles()->attach(Role::where('code', 'BUYER')->firstOrFail());
        }
        $sale = CattleSale::factory()->create(['owner_user_id' => $owner->id]);
        $this->postJson($this->url($sale), ['quantity_kg' => 10])->assertForbidden()
            ->assertJsonPath('message', 'You cannot reserve kilograms from your own cattle sale.');
        $this->assertDatabaseCount('cattle_sale_commitments', 0);
    }

    public function test_authentication_view_reserve_permissions_and_revocation(): void
    {
        $sale = $this->sale();
        $this->postJson($this->url($sale), ['quantity_kg' => 10])->assertUnauthorized();
        $this->getJson('/api/cattle-sales/marketplace')->assertUnauthorized();
        $this->buyer('FARMER');
        $this->getJson('/api/cattle-sales/marketplace')->assertOk();
        $this->postJson($this->url($sale), ['quantity_kg' => 10])->assertForbidden();
        $buyer = $this->buyer();
        $buyer->roles()->firstOrFail()->permissions()->detach();
        $this->postJson($this->url($sale), ['quantity_kg' => 10])->assertForbidden();
        $this->getJson('/api/cattle-sales/marketplace')->assertForbidden();
        $this->expectException(AccessDeniedHttpException::class);
        app(CattleSaleCommitmentService::class)->create($buyer, $sale->id, '10');
    }

    public function test_missing_sale_returns_normalized_not_found_and_buyers_cannot_edit_commitments(): void
    {
        $this->buyer();
        $this->postJson('/api/cattle-sales/99999/commitments', ['quantity_kg' => 10])->assertNotFound()->assertJsonPath('success', false);
        $commitment = CattleSaleCommitment::factory()->create();
        $this->patchJson('/api/cattle-sales/'.$commitment->cattle_sale_id.'/commitments/'.$commitment->id, ['status' => 'CANCELLED'])->assertNotFound();
        $this->assertSame(CattleSaleCommitmentStatus::Confirmed, $commitment->fresh()->status);
    }

    public function test_marketplace_lists_open_sales_without_private_owner_or_buyer_information(): void
    {
        $this->buyer();
        $sale = $this->sale();
        CattleSale::factory()->create(['status' => CattleSaleStatus::FullyCommitted]);
        $this->getJson('/api/cattle-sales/marketplace')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $sale->id)->assertJsonMissingPath('data.0.owner_user_id')
            ->assertJsonMissingPath('data.0.commitments')->assertJsonPath('data.0.available_weight_kg', '250.000');
    }

    public function test_sale_lock_is_requested_inside_transaction_and_failed_insert_rolls_back(): void
    {
        $buyer = $this->buyer();
        $sale = $this->sale();
        $real = app(CattleSaleRepository::class);
        $repository = \Mockery::mock(CattleSaleRepository::class)->makePartial();
        $repository->shouldReceive('lock')->once()->with($sale->id)->andReturnUsing(function (int $id) use ($real): CattleSale {
            $this->assertGreaterThan(0, DB::transactionLevel());

            return $real->lock($id);
        });
        $this->app->instance(CattleSaleRepository::class, $repository);
        $repository->shouldReceive('markFullyCommitted')->once()->andThrow(new \RuntimeException('Simulated persistence failure'));
        try {
            app(CattleSaleCommitmentService::class)->create($buyer, $sale->id, '250');
            $this->fail('Expected transaction failure.');
        } catch (\RuntimeException $exception) {
            $this->assertSame('Simulated persistence failure', $exception->getMessage());
        }
        $this->assertDatabaseCount('cattle_sale_commitments', 0);
        $this->assertSame(CattleSaleStatus::Open, $sale->fresh()->status);
    }

    public function test_availability_migration_preserves_sales_and_rollback_rebuilds_from_confirmed_kg(): void
    {
        $sale = $this->sale();
        CattleSaleCommitment::factory()->create(['cattle_sale_id' => $sale->id, 'quantity_kg' => '85.000']);
        CattleSaleCommitment::factory()->create(['cattle_sale_id' => $sale->id, 'quantity_kg' => '10.000', 'status' => CattleSaleCommitmentStatus::Cancelled]);
        $migration = require database_path('migrations/2026_09_30_150347_remove_available_weight_from_cattle_sales.php');
        $migration->down();
        $stored = DB::table('cattle_sales')->where('id', $sale->id)->value('available_weight_kg');
        $this->assertSame('165.000', (string) BigDecimal::of((string) $stored)->toScale(3));
        $migration->up();
        $this->assertFalse(Schema::hasColumn('cattle_sales', 'available_weight_kg'));
        $this->assertDatabaseHas('cattle_sales', ['id' => $sale->id, 'reference' => $sale->reference]);
        $this->assertDatabaseCount('cattle_sale_commitments', 2);
        $this->assertSame('165.000', $sale->fresh()->available_weight_kg);
    }
}
