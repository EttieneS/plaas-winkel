<?php

namespace Tests\Feature;

use App\CattleReservationFulfilment;
use App\CattleSaleCommitmentStatus;
use App\CattleSaleStatus;
use App\Models\CattleSale;
use App\Models\CattleSaleCommitment;
use App\Models\Role;
use App\Models\User;
use App\Repositories\CattleSaleRepository;
use App\Services\CattleSaleFulfilmentService;
use Database\Seeders\RbacSeeder;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\TestWith;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Tests\TestCase;

class CattleSaleFulfilmentTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function actor(string $role = 'FARMER'): User
    {
        $this->seed(RbacSeeder::class);
        $user = User::factory()->create();
        $user->roles()->attach(Role::where('code', $role)->firstOrFail());
        Sanctum::actingAs($user);

        return $user;
    }

    private function sale(User $owner, CattleSaleStatus $status = CattleSaleStatus::TargetReached): CattleSale
    {
        return CattleSale::factory()->create(['owner_user_id' => $owner->id, 'status' => $status,
            'target_reached_at' => now(), 'estimated_weight_kg' => '10.000']);
    }

    private function url(CattleSale $sale, string $action = ''): string
    {
        return '/api/cattle-sales/'.$sale->id.'/fulfilment'.($action ? '/'.$action : '');
    }

    private function evidence(): array
    {
        return ['occurred_at' => now()->toIso8601String(), 'processor_name' => 'Recorded abattoir',
            'batch_reference' => 'BATCH-001', 'notes' => 'Recorded evidence only'];
    }

    public function test_target_is_recorded_atomically_only_when_confirmed_reservations_fill_capacity_without_starting_sla(): void
    {
        $buyer = $this->actor('BUYER');
        $sale = CattleSale::factory()->create(['estimated_weight_kg' => '0.300']);
        $url = '/api/cattle-sales/'.$sale->id.'/commitments';
        $this->freezeSecond();
        $this->postJson($url, ['quantity_kg' => '0.1'])->assertCreated()->assertJsonPath('data.sale.status', 'OPEN');
        $this->assertNull($sale->fresh()->target_reached_at);
        $this->postJson($url, ['quantity_kg' => '0.2'])->assertCreated()->assertJsonPath('data.sale.status', 'TARGET_REACHED');
        $updated = $sale->fresh();
        $this->assertTrue($updated->target_reached_at->equalTo(now()));
        $this->assertNull($updated->accepted_at);
        $this->assertNull($updated->fulfilment_due_at);
        $this->assertDatabaseCount('cattle_sale_events', 1);
    }

    public function test_acceptance_deadline_and_overdue_do_not_cancel_and_acceptance_starts_configurable_sla(): void
    {
        $this->freezeSecond();
        $owner = $this->actor();
        $sale = $this->sale($owner);
        $this->getJson($this->url($sale))->assertOk()
            ->assertJsonPath('data.acceptance_due_at', now()->addHours(48)->toJSON())
            ->assertJsonPath('data.fulfilment_due_at', null)->assertJsonPath('data.acceptance_overdue', false);
        $this->travel(49)->hours();
        $this->getJson($this->url($sale))->assertOk()->assertJsonPath('data.acceptance_overdue', true)
            ->assertJsonPath('data.status', 'TARGET_REACHED')->assertJsonPath('data.fulfilment_overdue', false);
        $this->postJson($this->url($sale, 'accept'))->assertOk()->assertJsonPath('data.status', 'ACCEPTED')
            ->assertJsonPath('data.accepted_at', now()->toJSON())
            ->assertJsonPath('data.fulfilment_due_at', now()->addDays(7)->toJSON())
            ->assertJsonPath('data.sla_days', 7)->assertJsonPath('data.acceptance_overdue', false);
        config(['cattle.sla_days' => 3]);
        $this->assertSame(7, $sale->fresh()->sla_days);
        $another = $this->sale($owner);
        $this->postJson($this->url($another, 'accept'))->assertOk()
            ->assertJsonPath('data.fulfilment_due_at', now()->addDays(3)->toJSON());
        config(['cattle.acceptance_hours' => 12]);
        $this->getJson($this->url($another))->assertOk()
            ->assertJsonPath('data.acceptance_due_at', $another->target_reached_at->addHours(12)->toJSON());
    }

    public function test_legacy_target_time_remains_unknown_but_farmer_can_accept(): void
    {
        $owner = $this->actor();
        $sale = $this->sale($owner);
        $sale->update(['target_reached_at' => null]);
        $this->getJson($this->url($sale))->assertOk()->assertJsonPath('data.acceptance_due_at', null)
            ->assertJsonPath('data.acceptance_overdue', false);
        $this->postJson($this->url($sale, 'accept'))->assertOk()->assertJsonPath('data.status', 'ACCEPTED');
    }

    #[TestWith(['OPEN', 'accept'])]
    #[TestWith(['TARGET_REACHED', 'slaughter'])]
    #[TestWith(['ACCEPTED', 'processing'])]
    #[TestWith(['SLAUGHTERED', 'ready'])]
    public function test_invalid_transitions_are_rejected(string $status, string $action): void
    {
        $owner = $this->actor();
        $sale = $this->sale($owner, CattleSaleStatus::from($status));
        $this->postJson($this->url($sale, $action), $this->evidence())->assertConflict()->assertJsonPath('success', false);
        $this->assertSame($status, $sale->fresh()->status->value);
        $this->assertDatabaseCount('cattle_sale_events', 0);
    }

    #[TestWith(['FARMER'])]
    #[TestWith(['ADMIN'])]
    #[TestWith(['BUYER'])]
    public function test_other_accounts_cannot_view_or_manage_owned_sale(string $role): void
    {
        $sale = CattleSale::factory()->create(['status' => CattleSaleStatus::TargetReached]);
        $this->actor($role);
        $this->getJson($this->url($sale))->assertForbidden()->assertJsonMissingPath('data.reservations');
        foreach (['accept', 'slaughter', 'processing', 'ready', 'reservations/1/collect', 'reservations/1/deliver'] as $action) {
            $this->postJson($this->url($sale, $action), $this->evidence())->assertForbidden();
        }
    }

    public function test_authentication_revocation_and_service_authorization(): void
    {
        $sale = CattleSale::factory()->create();
        $this->getJson($this->url($sale))->assertUnauthorized();
        $owner = $this->actor();
        $sale->update(['owner_user_id' => $owner->id]);
        $owner->roles()->firstOrFail()->permissions()->detach();
        $this->getJson($this->url($sale))->assertForbidden();
        $this->expectException(AccessDeniedHttpException::class);
        app(CattleSaleFulfilmentService::class)->view($owner, $sale->id);
    }

    public function test_full_workflow_preserves_evidence_prices_and_requires_every_non_cancelled_reservation(): void
    {
        $this->freezeSecond();
        $owner = $this->actor();
        $sale = $this->sale($owner);
        $first = CattleSaleCommitment::factory()->create(['cattle_sale_id' => $sale->id,
            'quantity_kg' => '0.125', 'price_per_kg' => '10.04']);
        $second = CattleSaleCommitment::factory()->create(['cattle_sale_id' => $sale->id, 'status' => CattleSaleCommitmentStatus::Pending]);
        $cancelled = CattleSaleCommitment::factory()->create(['cattle_sale_id' => $sale->id, 'status' => CattleSaleCommitmentStatus::Cancelled]);
        $sale->update(['price_per_kg' => '900.00']);
        $this->postJson($this->url($sale, 'accept'))->assertOk();
        $this->postJson($this->url($sale, 'reservations/'.$first->id.'/collect'))->assertConflict();
        $this->postJson($this->url($sale, 'slaughter'), $this->evidence())->assertOk()
            ->assertJsonPath('data.slaughtered_at', now()->toJSON())
            ->assertJsonPath('data.traceability.1.processor_name', 'Recorded abattoir');
        $this->postJson($this->url($sale, 'processing'), array_replace($this->evidence(), ['batch_reference' => 'PROCESS-002']))
            ->assertOk()->assertJsonPath('data.processing_started_at', now()->toJSON())
            ->assertJsonPath('data.traceability.1.batch_reference', 'BATCH-001')
            ->assertJsonPath('data.traceability.2.batch_reference', 'PROCESS-002');
        $this->travel(8)->days();
        $this->getJson($this->url($sale))->assertOk()->assertJsonPath('data.fulfilment_overdue', true);
        $this->postJson($this->url($sale, 'ready'))->assertOk()->assertJsonPath('data.fulfilment_overdue', false)
            ->assertJsonPath('data.ready_for_fulfilment_at', now()->toJSON());
        $this->postJson($this->url($sale, 'reservations/'.$cancelled->id.'/collect'))->assertConflict();
        $unrelated = CattleSaleCommitment::factory()->create();
        $this->postJson($this->url($sale, 'reservations/'.$unrelated->id.'/collect'))->assertNotFound();
        $this->postJson($this->url($sale, 'reservations/'.$first->id.'/collect'))->assertOk()
            ->assertJsonPath('data.status', 'READY_FOR_FULFILMENT')->assertJsonPath('data.fulfilled_at', null)
            ->assertJsonPath('data.reservations.0.total_amount', '1.26')->assertJsonPath('data.reservations.0.price_per_kg', '10.04')
            ->assertJsonPath('data.reservations.0.fulfilment_state', 'COLLECTED')
            ->assertJsonMissingPath('data.reservations.0.buyer_user_id')->assertJsonMissingPath('data.reservations.0.email');
        $this->postJson($this->url($sale, 'reservations/'.$first->id.'/deliver'))->assertConflict();
        $this->postJson($this->url($sale, 'reservations/'.$second->id.'/deliver'))->assertOk()
            ->assertJsonPath('data.status', 'FULFILLED')->assertJsonPath('data.fulfilled_at', now()->toJSON())
            ->assertJsonPath('data.reservation_summary.unfulfilled', 0)->assertJsonPath('data.fulfilment_overdue', false);
        $this->assertSame('1.26', $first->fresh()->total_amount);
        $this->assertSame(CattleSaleCommitmentStatus::Pending, $second->fresh()->status);
        $this->assertNull($cancelled->fresh()->fulfilled_at);
    }

    public function test_evidence_validation_and_stage_order_do_not_persist_false_history(): void
    {
        $this->freezeSecond();
        $owner = $this->actor();
        $sale = $this->sale($owner);
        $this->postJson($this->url($sale, 'accept'))->assertOk();
        $this->postJson($this->url($sale, 'slaughter'), [])->assertUnprocessable()
            ->assertJsonValidationErrors(['occurred_at', 'processor_name', 'batch_reference']);
        $this->postJson($this->url($sale, 'slaughter'), array_replace($this->evidence(), ['occurred_at' => now()->subDay()->toJSON()]))
            ->assertUnprocessable()->assertJsonValidationErrors('occurred_at');
        $this->postJson($this->url($sale, 'slaughter'), array_replace($this->evidence(), ['occurred_at' => now()->addDay()->toJSON()]))
            ->assertUnprocessable();
        $this->assertDatabaseCount('cattle_sale_events', 1);
    }

    public function test_transition_locks_inside_transaction_and_rolls_back_when_history_write_fails(): void
    {
        $owner = $this->actor();
        $sale = $this->sale($owner);
        $real = app(CattleSaleRepository::class);
        $repository = \Mockery::mock(CattleSaleRepository::class)->makePartial();
        $repository->shouldReceive('lock')->once()->andReturnUsing(function () use ($real, $sale): CattleSale {
            $this->assertGreaterThan(0, DB::transactionLevel());

            return $real->lock($sale->id);
        });
        $repository->shouldReceive('recordEvent')->once()->andThrow(new \RuntimeException('History failure'));
        $this->app->instance(CattleSaleRepository::class, $repository);
        try {
            app(CattleSaleFulfilmentService::class)->accept($owner, $sale->id);
            $this->fail('Expected history failure.');
        } catch (\RuntimeException $exception) {
            $this->assertSame('History failure', $exception->getMessage());
        }
        $this->assertNull($sale->fresh()->accepted_at);
        $this->assertSame(CattleSaleStatus::TargetReached, $sale->fresh()->status);
    }

    public function test_duplicate_acceptance_cannot_restart_the_sla(): void
    {
        $this->freezeSecond();
        $owner = $this->actor();
        $sale = $this->sale($owner);
        $this->postJson($this->url($sale, 'accept'))->assertOk();
        $accepted = $sale->fresh()->accepted_at;
        $due = $sale->fresh()->fulfilment_due_at;
        $this->travel(2)->days();
        $this->postJson($this->url($sale, 'accept'))->assertConflict();
        $this->assertTrue($sale->fresh()->accepted_at->equalTo($accepted));
        $this->assertTrue($sale->fresh()->fulfilment_due_at->equalTo($due));
        $this->assertDatabaseCount('cattle_sale_events', 1);
    }

    public function test_fulfilment_locks_sale_and_rolls_back_reservation_and_final_status_if_history_fails(): void
    {
        $owner = $this->actor();
        $sale = $this->sale($owner, CattleSaleStatus::ReadyForFulfilment);
        $reservation = CattleSaleCommitment::factory()->create(['cattle_sale_id' => $sale->id]);
        $real = app(CattleSaleRepository::class);
        $repository = \Mockery::mock(CattleSaleRepository::class)->makePartial();
        $repository->shouldReceive('lock')->once()->andReturnUsing(function () use ($real, $sale): CattleSale {
            $this->assertGreaterThan(0, DB::transactionLevel());

            return $real->lock($sale->id);
        });
        $repository->shouldReceive('recordEvent')->once()->andReturnNull();
        $repository->shouldReceive('recordEvent')->once()->andThrow(new \RuntimeException('Final history failure'));
        $this->app->instance(CattleSaleRepository::class, $repository);
        try {
            app(CattleSaleFulfilmentService::class)->fulfilReservation($owner, $sale->id, $reservation->id,
                CattleReservationFulfilment::Delivered);
            $this->fail('Expected history failure.');
        } catch (\RuntimeException $exception) {
            $this->assertSame('Final history failure', $exception->getMessage());
        }
        $this->assertNull($reservation->fresh()->fulfilled_at);
        $this->assertSame('UNFULFILLED', $reservation->fresh()->fulfilment_state->value);
        $this->assertSame(CattleSaleStatus::ReadyForFulfilment, $sale->fresh()->status);
        $this->assertNull($sale->fresh()->fulfilled_at);
    }

    public function test_rollback_refuses_to_erase_recorded_lifecycle_history(): void
    {
        $owner = $this->actor();
        $sale = $this->sale($owner);
        $this->postJson($this->url($sale, 'accept'))->assertOk();
        $migration = require database_path('migrations/2026_10_01_064558_add_fulfilment_workflow_to_cattle_sales.php');
        try {
            $migration->down();
            $this->fail('Expected rollback protection.');
        } catch (\RuntimeException $exception) {
            $this->assertStringContainsString('Cannot roll back fulfilment', $exception->getMessage());
        }
        $this->assertDatabaseCount('cattle_sale_events', 1);
        $this->assertSame(CattleSaleStatus::Accepted, $sale->fresh()->status);
    }

    public function test_migration_preserves_legacy_reservations_and_unknown_target_time(): void
    {
        $sale = CattleSale::factory()->create();
        $reservation = CattleSaleCommitment::factory()->create(['cattle_sale_id' => $sale->id, 'price_per_kg' => '10.04']);
        $migration = require database_path('migrations/2026_10_01_064558_add_fulfilment_workflow_to_cattle_sales.php');
        $migration->down();
        DB::table('cattle_sales')->where('id', $sale->id)->update(['status' => 'FULLY_COMMITTED']);
        $migration->up();
        $this->assertSame(CattleSaleStatus::TargetReached, $sale->fresh()->status);
        $this->assertNull($sale->fresh()->target_reached_at);
        $this->assertSame('10.04', $reservation->fresh()->price_per_kg);
        $this->assertDatabaseCount('cattle_sale_commitments', 1);
    }
}
