import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { finalize } from 'rxjs';
import { CattleListing } from '../../../interfaces/cattle-listing.interface';
import { CattleService } from '../../../services/cattle.service';
import { ApiFeedbackError } from '../../../services/api-feedback.service';
import { UtilToastService } from '../../../services/util-toast.service';

@Component({
  selector: 'app-cattle-create',
  imports: [ReactiveFormsModule, CurrencyPipe, DecimalPipe, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatIconModule],
  templateUrl: './create.html',
  styleUrl: './create.scss',
})
export class Create {
  private readonly cattle = inject(CattleService);
  private readonly toast = inject(UtilToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly submitting = signal(false);
  readonly errors = signal<Record<string, string[]>>({});
  readonly created = signal<CattleListing | null>(null);
  readonly form = inject(FormBuilder).group({
    title: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(255)]],
    description: ['', Validators.maxLength(10000)],
    carcass_weight_kg: [null as number | null, [Validators.required, Validators.min(0.001),
      Validators.max(999999.999), Validators.pattern(/^\d+(?:\.\d{1,3})?$/)]],
    price_per_kg: [null as number | null, [Validators.required, Validators.min(0.01),
      Validators.max(999999.99), Validators.pattern(/^\d+(?:\.\d{1,2})?$/)]],
  });

  get weight(): number {
    return this.previewNumber(this.form.controls.carcass_weight_kg.value);
  }

  get price(): number {
    return this.previewNumber(this.form.controls.price_per_kg.value);
  }

  get estimatedTotal(): number {
    return this.weight * this.price;
  }

  fieldError(field: string): string {
    return this.errors()[field]?.join(' ') ?? '';
  }

  create(): void {
    if (this.submitting()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.toast.warning('Please complete the listing with a title, valid weight and price.');
      return;
    }
    const data = this.form.getRawValue();
    this.errors.set({});
    this.created.set(null);
    this.submitting.set(true);
    this.cattle.create({
      title: data.title!.trim(),
      description: data.description?.trim() || null,
      carcass_weight_kg: data.carcass_weight_kg!,
      price_per_kg: data.price_per_kg!,
    }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.created.set(response.data);
            this.form.reset();
          }
        },
        error: (error: ApiFeedbackError) => this.errors.set(error.errors),
      });
  }

  private previewNumber(value: number | null): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
  }
}
