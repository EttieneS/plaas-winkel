import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { finalize } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { UsersService } from '../../../services/users.service';
import { UsersPage } from '../../../interfaces/users.interface';

@Component({
  selector: 'app-users-index',
  imports: [RouterLink, MatButtonModule],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class Index implements OnInit {
  readonly auth = inject(AuthService);
  private readonly usersService = inject(UsersService);
  private readonly destroyRef = inject(DestroyRef);
  readonly result = signal<UsersPage | null>(null);
  readonly loading = signal(false);
  readonly failed = signal(false);

  ngOnInit(): void { this.load(); }

  load(page = 1): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.failed.set(false);
    this.usersService.list(page)
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
