import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { CattleMarketplaceService } from '../../../services/cattle-marketplace.service';
import { AuthService } from '../../../services/auth.service';
import { MarketplaceCattleSale } from '../../../interfaces/cattle-sale.interface';
import { CattleReservationComponent } from '../../../components/sales/cattle-reservation/cattle-reservation.component';

@Component({
  imports: [RouterLink, MatButtonModule, CattleReservationComponent],
  selector: 'app-index',
  styleUrl: './index.scss',
  templateUrl: './index.html',
})
export class Index implements OnInit {
  readonly auth = inject(AuthService);
  private readonly marketplace = inject(CattleMarketplaceService);
  private readonly destroyRef = inject(DestroyRef);
  readonly sales = signal<MarketplaceCattleSale[]>([]);
  readonly loading = signal(false);
  readonly failed = signal(false);

  ngOnInit(): void { if (this.auth.hasPermission('cattle.view')) this.load(); }

  load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.failed.set(false);
    this.marketplace.list().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false)))
      .subscribe({ next: (response) => {
        if (response.success && response.data) this.sales.set(response.data);
        else this.failed.set(true);
      }, error: () => this.failed.set(true) });
  }

  updateSale(sale: MarketplaceCattleSale): void {
    this.sales.update((sales) => sales.map((item) => item.id === sale.id ? sale : item));
  }
}
