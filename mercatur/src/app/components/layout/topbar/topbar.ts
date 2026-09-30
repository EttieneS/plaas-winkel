import { Component, inject, input, output } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-topbar',
  imports: [MatToolbarModule, RouterLink, MatButtonModule],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class Topbar {
  readonly session = inject(AuthService);
  private readonly router = inject(Router);
  readonly menuOpen = input(false);
  readonly menuToggle = output<void>();

  logout(): void {
    this.session.logout();
    void this.router.navigate(['/auth/login'], { replaceUrl: true });
  }
}
