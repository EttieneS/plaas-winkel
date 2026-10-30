<?php

namespace App\Services;

use App\CattleReservationFulfilment;
use App\CattleSaleCommitmentStatus;
use App\CattleSaleStatus;
use App\Models\CattleSale;
use App\Models\User;
use App\Repositories\CattleSaleCommitmentRepository;
use App\Repositories\CattleSaleRepository;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class CattleSaleFulfilmentService
{
    public function __construct(private CattleSaleRepository $sales,
        private CattleSaleCommitmentRepository $commitments) {}

    public function view(User $actor, int $id): array
    {
        $sale = $this->sales->find($id);
        $this->authorize($actor, $sale);

        return $this->present($this->sales->details($sale));
    }

    private function authorize(User $actor, CattleSale $sale): void
    {
        if (! $actor->hasPermission('cattle.manage') || $sale->owner_user_id !== $actor->id) {
            throw new AccessDeniedHttpException('You may only manage your own cattle sales with the cattle.manage permission.');
        }
    }

    public function accept(User $actor, int $id): array
    {
        return $this->transition($actor, $id, CattleSaleStatus::TargetReached, CattleSaleStatus::Accepted, 'accepted_at');
    }

    public function slaughter(User $actor, int $id, array $evidence): array
    {
        return $this->transition($actor, $id, CattleSaleStatus::Accepted, CattleSaleStatus::Slaughtered, 'slaughtered_at', $evidence);
    }

    public function process(User $actor, int $id, array $evidence): array
    {
        return $this->transition($actor, $id, CattleSaleStatus::Slaughtered, CattleSaleStatus::Processing, 'processing_started_at', $evidence);
    }

    public function ready(User $actor, int $id): array
    {
        return $this->transition($actor, $id, CattleSaleStatus::Processing, CattleSaleStatus::ReadyForFulfilment, 'ready_for_fulfilment_at');
    }

    private function transition(User $actor, int $id, CattleSaleStatus $from, CattleSaleStatus $to,
        string $timestamp, array $evidence = []): array
    {
        return DB::transaction(function () use ($actor, $id, $from, $to, $timestamp, $evidence): array {
            $sale = $this->sales->lock($id);
            $this->authorize($actor, $sale);
            if ($sale->status !== $from) {
                throw new ConflictHttpException('This action requires a cattle sale in '.$from->value.' status.');
            }
            $occurred = isset($evidence['occurred_at']) ? CarbonImmutable::parse($evidence['occurred_at']) : CarbonImmutable::now();
            $previous = match ($from) {
                CattleSaleStatus::Accepted => $sale->accepted_at,
                CattleSaleStatus::Slaughtered => $sale->slaughtered_at,
                default => null,
            };
            if ($occurred->isFuture() || ($previous && $occurred->lessThan($previous))) {
                throw ValidationException::withMessages(['occurred_at' => ['The event must follow the previous stage and cannot be in the future.']]);
            }
            $attributes = ['status' => $to, $timestamp => $occurred];
            if ($to === CattleSaleStatus::Accepted) {
                $days = (int) config('cattle.sla_days');
                $attributes += ['sla_days' => $days, 'fulfilment_due_at' => $occurred->addDays($days)];
            }
            $this->sales->update($sale, $attributes);
            $this->sales->recordEvent($sale, ['actor_user_id' => $actor->id, 'from_status' => $from->value,
                'to_status' => $to->value, 'occurred_at' => $occurred,
                'processor_name' => $evidence['processor_name'] ?? null,
                'batch_reference' => $evidence['batch_reference'] ?? null, 'notes' => $evidence['notes'] ?? null]);

            return $this->present($this->sales->details($sale));
        }, 5);
    }

    public function fulfilReservation(User $actor, int $id, int $reservationId, CattleReservationFulfilment $method): array
    {
        return DB::transaction(function () use ($actor, $id, $reservationId, $method): array {
            $sale = $this->sales->lock($id);
            $this->authorize($actor, $sale);
            if ($sale->status !== CattleSaleStatus::ReadyForFulfilment) {
                throw new ConflictHttpException('Reservations can only be fulfilled when the meat is ready for fulfilment.');
            }
            $reservation = $sale->commitments->firstWhere('id', $reservationId);
            if (! $reservation) {
                throw new NotFoundHttpException('Reservation not found for this cattle sale.');
            }
            if ($reservation->status === CattleSaleCommitmentStatus::Cancelled
                || $reservation->fulfilment_state !== CattleReservationFulfilment::Unfulfilled
                || $method === CattleReservationFulfilment::Unfulfilled) {
                throw new ConflictHttpException('This reservation cannot be marked collected or delivered.');
            }
            $occurred = CarbonImmutable::now();
            $this->commitments->update($reservation, ['fulfilment_state' => $method, 'fulfilled_at' => $occurred]);
            $this->sales->recordEvent($sale, ['actor_user_id' => $actor->id, 'cattle_sale_commitment_id' => $reservationId,
                'from_status' => $sale->status->value, 'to_status' => $sale->status->value,
                'occurred_at' => $occurred, 'fulfilment_state' => $method->value]);
            $relevant = $sale->commitments->filter(fn ($item) => $item->status !== CattleSaleCommitmentStatus::Cancelled);
            if ($relevant->isNotEmpty() && $relevant->every(fn ($item) => $item->fulfilment_state !== CattleReservationFulfilment::Unfulfilled)) {
                $this->sales->update($sale, ['status' => CattleSaleStatus::Fulfilled, 'fulfilled_at' => $occurred]);
                $this->sales->recordEvent($sale, ['actor_user_id' => $actor->id,
                    'from_status' => CattleSaleStatus::ReadyForFulfilment->value, 'to_status' => CattleSaleStatus::Fulfilled->value,
                    'occurred_at' => $occurred]);
            }

            return $this->present($this->sales->details($sale));
        }, 5);
    }

    private function present(CattleSale $sale): array
    {
        $due = $sale->target_reached_at?->addHours((int) config('cattle.acceptance_hours'));
        $action = match ($sale->status) {
            CattleSaleStatus::TargetReached => 'ACCEPT',
            CattleSaleStatus::Accepted => 'RECORD_SLAUGHTER',
            CattleSaleStatus::Slaughtered => 'START_PROCESSING',
            CattleSaleStatus::Processing => 'MARK_READY',
            default => null,
        };
        $reservations = $sale->commitments->sortBy('id')->map(fn ($item): array => [
            'id' => $item->id, 'buyer_name' => $item->buyer->name,
            'quantity_kg' => $item->quantity_kg, 'price_per_kg' => $item->price_per_kg,
            'total_amount' => $item->total_amount, 'status' => $item->status->value,
            'fulfilment_state' => $item->fulfilment_state->value, 'fulfilled_at' => $item->fulfilled_at,
            'permitted_actions' => $sale->status === CattleSaleStatus::ReadyForFulfilment
                && $item->status !== CattleSaleCommitmentStatus::Cancelled
                && $item->fulfilment_state === CattleReservationFulfilment::Unfulfilled ? ['COLLECT', 'DELIVER'] : [],
        ])->values();

        return [
            'id' => $sale->id, 'reference' => $sale->reference, 'description' => $sale->description,
            'estimated_weight_kg' => $sale->estimated_weight_kg, 'price_per_kg' => $sale->price_per_kg,
            'committed_weight_kg' => $sale->committed_weight_kg, 'remaining_weight_kg' => $sale->remaining_weight_kg,
            'available_weight_kg' => $sale->available_weight_kg, 'status' => $sale->status->value,
            'target_reached_at' => $sale->target_reached_at, 'acceptance_due_at' => $due,
            'accepted_at' => $sale->accepted_at, 'sla_days' => $sale->sla_days,
            'fulfilment_due_at' => $sale->fulfilment_due_at, 'slaughtered_at' => $sale->slaughtered_at,
            'processing_started_at' => $sale->processing_started_at,
            'ready_for_fulfilment_at' => $sale->ready_for_fulfilment_at, 'fulfilled_at' => $sale->fulfilled_at,
            'acceptance_overdue' => $sale->status === CattleSaleStatus::TargetReached && $due?->isPast() === true,
            'fulfilment_overdue' => $sale->accepted_at !== null && $sale->ready_for_fulfilment_at === null
                && $sale->fulfilment_due_at?->isPast() === true,
            'fulfilment_seconds_remaining' => $sale->fulfilment_due_at && ! $sale->ready_for_fulfilment_at
                ? max(0, (int) now()->diffInSeconds($sale->fulfilment_due_at, false)) : null,
            'permitted_actions' => $action ? [$action] : [], 'reservations' => $reservations,
            'reservation_summary' => ['total' => $reservations->count(),
                'unfulfilled' => $reservations->filter(fn ($item) => $item['status'] !== 'CANCELLED'
                    && $item['fulfilment_state'] === 'UNFULFILLED')->count()],
            'traceability' => $sale->events->map(fn ($event): array => [
                'id' => $event->id, 'from_status' => $event->from_status, 'stage' => $event->to_status,
                'occurred_at' => $event->occurred_at, 'recorded_at' => $event->created_at,
                'processor_name' => $event->processor_name, 'batch_reference' => $event->batch_reference,
                'notes' => $event->notes, 'reservation_id' => $event->cattle_sale_commitment_id,
                'fulfilment_state' => $event->fulfilment_state,
            ])->values(),
        ];
    }
}
