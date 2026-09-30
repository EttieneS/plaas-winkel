import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { finalize } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  email = environment.devLogin.email;
  password = environment.devLogin.password;
  readonly submitting = signal(false);

  login(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.authService
      .login(this.email, this.password)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (response) => {
          if (response.success && response.data?.token) {
            void this.router.navigate(['/sales/index'], { replaceUrl: true });
          }
        },
        error: () => {},
      });
  }
}
