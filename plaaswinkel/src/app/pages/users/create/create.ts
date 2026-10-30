import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';
import { Role } from '../../../interfaces/role.interface';
import { AuthService } from '../../../services/auth.service';
import { UsersService } from '../../../services/users.service';
import { UtilToastService } from '../../../services/util-toast.service';
import { ApiFeedbackError } from '../../../services/api-feedback.service';

@Component({
  selector: 'app-users-create',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './create.html',
  styleUrl: './create.scss',
})
export class Create implements OnInit {
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(UtilToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly roles = signal<Role[]>([]);
  readonly loadingRoles = signal(false);
  readonly rolesFailed = signal(false);
  readonly submitting = signal(false);
  readonly errors = signal<Record<string, string[]>>({});
  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
    password_confirmation: ['', Validators.required],
    role_ids: [[] as number[], Validators.required],
  });
  readonly backRoute = this.auth.hasPermission('users.view') ? '/users' : '/sales/index';

  ngOnInit(): void { this.loadRoles(); }

  loadRoles(): void {
    if (this.loadingRoles()) return;
    this.loadingRoles.set(true);
    this.rolesFailed.set(false);
    this.users.roles()
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loadingRoles.set(false)))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) this.roles.set(response.data);
          else this.rolesFailed.set(true);
        },
        error: () => this.rolesFailed.set(true),
      });
  }

  fieldError(field: string): string {
    return Object.entries(this.errors())
      .filter(([key]) => key === field || key.startsWith(field + '.'))
      .flatMap(([, messages]) => messages).join(' ');
  }

  create(): void {
    if (this.submitting() || this.loadingRoles() || this.rolesFailed()) return;
    this.form.markAllAsTouched();
    const data = this.form.getRawValue();
    if (this.form.invalid) {
      this.toast.warning('Please complete all required fields with valid values.');
      return;
    }
    if (data.password !== data.password_confirmation) {
      this.toast.warning('The password confirmation does not match.');
      return;
    }
    this.errors.set({});
    this.submitting.set(true);
    this.users.create(data)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.form.reset();
            void this.router.navigate([this.backRoute]);
          }
        },
        error: (error: ApiFeedbackError) => this.errors.set(error.errors),
      });
  }
}
