import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';
import { Product } from '../../../interfaces/product.interface';
import { ProductService } from '../../../services/product.service';
import { UtilToastService } from '../../../services/util-toast.service';

@Component({
  selector: 'app-sell-index',
  imports: [MatButtonModule, MatFormFieldModule, MatSelectModule],
  templateUrl: './sell-index.component.html',
  styleUrl: './sell-index.component.scss',
})
export class SellIndexComponent implements OnInit {
  private readonly productsService = inject(ProductService);
  private readonly router = inject(Router);
  private readonly toast = inject(UtilToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly products = signal<Product[]>([]);
  readonly loading = signal(false);
  readonly failed = signal(false);

  ngOnInit(): void { this.load(); }

  load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.failed.set(false);
    this.productsService.list()
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) this.products.set(response.data);
          else this.failed.set(true);
        },
        error: () => this.failed.set(true),
      });
  }

  selectProduct(slug: string): void {
    const product = this.products().find((item) => item.slug === slug);
    if (!product) return;
    const workflows = this.router.config.find((route) => route.path === 'sell')?.children;
    if (workflows?.some((route) => route.path === product.slug)) {
      void this.router.navigate(['/sell', product.slug]);
    } else {
      this.toast.info(`${product.name}: Coming soon`);
    }
  }
}
