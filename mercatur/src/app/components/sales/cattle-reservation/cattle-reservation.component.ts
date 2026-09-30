import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { finalize } from 'rxjs';
import { MarketplaceCattleSale } from '../../../interfaces/cattle-sale.interface';
import { CattleMarketplaceService } from '../../../services/cattle-marketplace.service';
import { AuthService } from '../../../services/auth.service';
import { ApiFeedbackError } from '../../../services/api-feedback.service';

@Component({
  selector: 'app-cattle-reservation',
  imports: [ReactiveFormsModule, CurrencyPipe, DecimalPipe, MatButtonModule, MatFormFieldModule,
    MatInputModule, MatProgressBarModule],
  templateUrl: './cattle-reservation.component.html',
  styleUrl: './cattle-reservation.component.scss',
})
export class CattleReservationComponent {
  readonly sale = input.required<MarketplaceCattleSale>();
  readonly saleUpdated = output<MarketplaceCattleSale>();
  private readonly marketplace = inject(CattleMarketplaceService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly quantity = new FormControl<number | null>(null, [Validators.required, Validators.min(0.001),
    Validators.max(999999.999), Validators.pattern(/^\d+(?:\.\d{1,3})?$/)]);
  readonly form = new FormGroup({ quantity_kg: this.quantity });
  private readonly quantityValue = toSignal(this.quantity.valueChanges, { initialValue: null });
  readonly estimatedTotal = computed(() => (Number(this.quantityValue()) || 0) * Number(this.sale().price_per_kg));
  readonly canReserve = computed(() => this.auth.hasPermission('cattle.reserve')
    && this.sale().can_reserve && this.sale().status === 'OPEN');

  reserve(): void {
    if (this.submitting() || !this.canReserve()) return;
    this.quantity.markAsTouched();
    if (this.quantity.invalid) return;
    this.error.set('');
    this.submitting.set(true);
    this.marketplace.reserve(this.sale().id, this.quantity.value!)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.quantity.reset();
            this.saleUpdated.emit(response.data.sale);
          }
        },
        error: (error: ApiFeedbackError) => this.error.set(error.errors['quantity_kg']?.join(' ') || error.message),
      });
  }
}
