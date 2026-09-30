import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { finalize } from 'rxjs';
import { CattleSale } from '../../../../interfaces/cattle-sale.interface';
import { CattleSaleService } from '../../../../services/cattle-sale.service';
import { ApiFeedbackError } from '../../../../services/api-feedback.service';

@Component({
  selector: 'app-sell-cattle-index',
  imports: [ReactiveFormsModule, CurrencyPipe, DatePipe, DecimalPipe, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatTableModule],
  templateUrl: './cattle-index.component.html',
  styleUrl: './cattle-index.component.scss',
})
export class CattleIndexComponent implements OnInit {
  private readonly salesService = inject(CattleSaleService);
  private readonly destroyRef = inject(DestroyRef);
  readonly sales = signal<CattleSale[]>([]);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly showForm = signal(false);
  readonly submitting = signal(false);
  readonly errors = signal<Record<string, string[]>>({});
  readonly columns = ['reference', 'estimated', 'price', 'available', 'status', 'created', 'actions'];
  readonly form = inject(FormBuilder).group({
    estimated_weight_kg: [null as number | null, [Validators.required, Validators.min(0.001),
      Validators.max(999999.999), Validators.pattern(/^\d+(?:\.\d{1,3})?$/)]],
    price_per_kg: [null as number | null, [Validators.required, Validators.min(0.01),
      Validators.max(999999.99), Validators.pattern(/^\d+(?:\.\d{1,2})?$/)]],
    description: ['', Validators.maxLength(10000)],
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.failed.set(false);
    this.salesService.list()
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) this.sales.set(response.data);
          else this.failed.set(true);
        },
        error: () => this.failed.set(true),
      });
  }

  openForm(): void {
    this.errors.set({});
    this.showForm.set(true);
  }

  cancel(): void {
    if (this.submitting()) return;
    this.form.reset();
    this.errors.set({});
    this.showForm.set(false);
  }

  create(): void {
    if (this.submitting() || this.loading()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const values = this.form.getRawValue();
    this.errors.set({});
    this.submitting.set(true);
    this.salesService.create({
      estimated_weight_kg: values.estimated_weight_kg!,
      price_per_kg: values.price_per_kg!,
      description: values.description?.trim() || null,
    }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.form.reset();
            this.showForm.set(false);
            this.load();
          }
        },
        error: (error: ApiFeedbackError) => this.errors.set(error.errors),
      });
  }
}
