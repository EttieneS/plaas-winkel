import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { CattleMarketplaceService } from '../../../services/cattle-marketplace.service';
import { MyCattleReservationsPage } from '../../../interfaces/cattle-sale.interface';

@Component({
  selector: 'app-my-reservations',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, MatButtonModule, MatProgressBarModule],
  templateUrl: './my-reservations.html',
  styleUrl: './my-reservations.scss',
})
export class MyReservations implements OnInit {
  private readonly marketplace = inject(CattleMarketplaceService);
  private readonly destroyRef = inject(DestroyRef);
  readonly result = signal<MyCattleReservationsPage | null>(null);
  readonly loading = signal(false);
  readonly failed = signal(false);
  private requestedPage = 1;

  ngOnInit(): void { this.load(); }

  label(value: string): string { return value.toLowerCase().replaceAll('_', ' '); }

  load(page = this.requestedPage): void {
    if (this.loading()) return;
    this.requestedPage = page;
    this.loading.set(true);
    this.failed.set(false);
    this.marketplace.myReservations(page)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) this.result.set(response.data);
          else this.failed.set(true);
        },
        error: () => this.failed.set(true),
      });
  }
}
