import { Component, computed, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { DEMO_SALES } from '../sales.data';

@Component({
  selector: 'app-sale-details',
  imports: [CurrencyPipe, RouterLink, MatButtonModule],
  templateUrl: './details.html',
  styleUrl: './details.scss',
})
export class Details {
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  readonly sale = computed(() => DEMO_SALES.find(sale => sale.id === this.params()?.get('id')));
}
