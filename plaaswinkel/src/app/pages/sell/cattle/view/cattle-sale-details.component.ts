import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { EMPTY, Observable, Subject, catchError, finalize, map, merge, switchMap } from 'rxjs';
import { CattleSaleService } from '../../../../services/cattle-sale.service';
import { AuthService } from '../../../../services/auth.service';
import { ApiFeedbackError } from '../../../../services/api-feedback.service';
import { ApiResponse } from '../../../../interfaces/api-response.interface';
import { CattleSaleDetails, CattleFulfilmentAction, FarmerCattleReservation } from '../../../../interfaces/cattle-sale.interface';

@Component({
  selector: 'app-cattle-sale-details',
  imports: [RouterLink, CurrencyPipe, DatePipe, DecimalPipe, ReactiveFormsModule,
    MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './cattle-sale-details.component.html',
  styleUrl: './cattle-sale-details.component.scss',
})
export class CattleSaleDetailsComponent implements OnInit {
  private readonly service = inject(CattleSaleService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refresh = new Subject<void>();
  readonly auth = inject(AuthService);
  readonly sale = signal<CattleSaleDetails | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly failed = signal(false);
  readonly errors = signal<Record<string, string[]>>({});
  readonly evidenceAction = signal<CattleFulfilmentAction | null>(null);
  readonly labels: Record<CattleFulfilmentAction, string> = {
    ACCEPT: 'Accept Sale', RECORD_SLAUGHTER: 'Record Slaughter',
    START_PROCESSING: 'Start Processing', MARK_READY: 'Mark Ready for Fulfilment',
  };
  readonly stages = [
    { label: 'Target reached', field: 'target_reached_at' },
    { label: 'Accepted', field: 'accepted_at' },
    { label: 'Slaughtered', field: 'slaughtered_at' },
    { label: 'Processing', field: 'processing_started_at' },
    { label: 'Ready for fulfilment', field: 'ready_for_fulfilment_at' },
    { label: 'Fulfilled', field: 'fulfilled_at' },
  ] as const;
  readonly form = inject(FormBuilder).nonNullable.group({
    occurred_at: ['', Validators.required],
    processor_name: ['', [Validators.required, Validators.maxLength(255)]],
    batch_reference: ['', [Validators.required, Validators.maxLength(255)]],
    notes: ['', Validators.maxLength(10000)],
  });

  ngOnInit(): void {
    merge(this.route.paramMap, this.refresh.pipe(map(() => this.route.snapshot.paramMap)))
      .pipe(
        switchMap(params => {
          this.sale.set(null);
          this.evidenceAction.set(null);
          this.form.reset();
          this.errors.set({});
          this.loading.set(true);
          this.failed.set(false);
          return this.service.details(Number(params.get('id'))).pipe(
            catchError(() => { this.failed.set(true); return EMPTY; }),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      ).subscribe(response => {
        if (response.success && response.data) this.sale.set(response.data);
        else this.failed.set(true);
      });
  }

  load(): void {
    if (!this.loading() && !this.saving()) this.refresh.next();
  }

  allowed(action: CattleFulfilmentAction): boolean {
    return this.auth.hasPermission('cattle.manage') && !!this.sale()?.permitted_actions.includes(action);
  }

  act(action: CattleFulfilmentAction): void {
    const sale = this.sale();
    if (!sale || !this.allowed(action) || this.saving() || this.loading()) return;
    if (action === 'RECORD_SLAUGHTER' || action === 'START_PROCESSING') {
      this.evidenceAction.set(action);
      this.errors.set({});
      return;
    }
    this.save(this.service.transition(sale.id, action));
  }

  submitEvidence(): void {
    this.form.markAllAsTouched();
    const sale = this.sale();
    const action = this.evidenceAction();
    if (!sale || !action || !this.allowed(action) || this.form.invalid || this.saving() || this.loading()) return;
    const values = this.form.getRawValue();
    this.save(this.service.transition(sale.id, action, {
      ...values, occurred_at: new Date(values.occurred_at).toISOString(),
      processor_name: values.processor_name.trim(), batch_reference: values.batch_reference.trim(),
      notes: values.notes.trim() || null,
    }));
  }

  fulfil(reservation: FarmerCattleReservation, action: 'COLLECT' | 'DELIVER'): void {
    const sale = this.sale();
    if (!sale || this.saving() || this.loading() || !this.auth.hasPermission('cattle.manage')
      || !reservation.permitted_actions.includes(action)) return;
    this.save(this.service.fulfilReservation(sale.id, reservation.id, action));
  }

  private save(operation: Observable<ApiResponse<CattleSaleDetails>>): void {
    this.saving.set(true);
    this.errors.set({});
    operation.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving.set(false)))
      .subscribe({
        next: response => {
          if (response.success && response.data && response.data.id === Number(this.route.snapshot.paramMap.get('id'))) {
            this.sale.set(response.data);
            this.evidenceAction.set(null);
            this.form.reset();
          }
        },
        error: (error: ApiFeedbackError) => this.errors.set(error.errors),
      });
  }
}
