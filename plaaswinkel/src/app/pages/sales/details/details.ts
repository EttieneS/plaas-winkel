import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { CattleMarketplaceService } from '../../../services/cattle-marketplace.service';
import { MarketplaceCattleSale } from '../../../interfaces/cattle-sale.interface';
import { CattleReservationComponent } from '../../../components/sales/cattle-reservation/cattle-reservation.component';

@Component({
  selector: 'app-sale-details',
  imports: [RouterLink, MatButtonModule, CattleReservationComponent],
  templateUrl: './details.html',
  styleUrl: './details.scss',
})
export class Details implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly marketplace = inject(CattleMarketplaceService);
  private readonly destroyRef = inject(DestroyRef);
  readonly sale = signal<MarketplaceCattleSale | null>(null);
  readonly failed = signal(false);

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.sale.set(null);
      this.failed.set(false);
      const id = Number(params.get('id'));
      if (!Number.isSafeInteger(id) || id <= 0) { this.failed.set(true); return; }
      this.marketplace.get(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (response) => {
          if (response.success && response.data) this.sale.set(response.data);
          else this.failed.set(true);
        }, error: () => this.failed.set(true),
      });
    });
  }
}
