import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, finalize, map, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../interfaces/api-response.interface';
import { LoginRequest } from '../interfaces/login-request.interface';
import { LoginResponse } from '../interfaces/login-response.interface';
import { User } from '../interfaces/user.interface';
import { ApiFeedbackError, ApiFeedbackService } from './api-feedback.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly httpClient = inject(HttpClient);
  private readonly feedback = inject(ApiFeedbackService);
  private readonly currentUser = signal<User | null>(null);
  private loadingUser: Observable<User | null> | null = null;
  readonly user = this.currentUser.asReadonly();

  login(email: string, password: string): Observable<ApiResponse<LoginResponse>> {
    const credentials: LoginRequest = { email, password };
    return this.httpClient
      .post<ApiResponse<LoginResponse>>(`${environment.apiBaseUrl}/api/auth/login`, credentials)
      .pipe(
        tap((response) => {
          if (response.success && !response.data?.token) {
            throw new ApiFeedbackError('Unable to sign in. Please try again.', 200, {});
          }
          if (response.success && response.data?.token) {
            localStorage.setItem(environment.tokenKey, response.data.token);
            this.currentUser.set(response.data.user);
          }
        }),
        this.feedback.forOperation<LoginResponse>('Unable to sign in. Please try again.'),
      );
  }

  ensureUser(): Observable<User | null> {
    const token = this.getToken();
    if (!token) {
      this.currentUser.set(null);
      return of(null);
    }
    const user = this.currentUser();
    if (user) return of(user);
    if (this.loadingUser) return this.loadingUser;
    this.loadingUser = this.httpClient
      .get<ApiResponse<User>>(`${environment.apiBaseUrl}/api/auth/user`)
      .pipe(
        this.feedback.forOperation<User>('Unable to restore your session. Please try again.', false),
        map((response) => response.success && response.data ? response.data : null),
        map((profile) => this.getToken() === token ? profile : null),
        tap((profile) => {
          if (this.getToken() === token) this.currentUser.set(profile);
        }),
        catchError((error: ApiFeedbackError) => {
          if (error.status === 401 && this.getToken() === token) this.logout();
          return of(null);
        }),
        finalize(() => {
          if (this.getToken() === token) this.loadingUser = null;
        }),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
    return this.loadingUser;
  }

  hasRole(code: string): boolean {
    return this.currentUser()?.roles?.includes(code) ?? false;
  }

  hasPermission(code: string): boolean {
    return this.currentUser()?.permissions?.includes(code) ?? false;
  }

  hasPermissions(codes: readonly string[]): boolean {
    return codes.every((code) => this.hasPermission(code));
  }

  getToken(): string | null {
    return localStorage.getItem(environment.tokenKey);
  }

  logout(): void {
    localStorage.removeItem(environment.tokenKey);
    this.currentUser.set(null);
    this.loadingUser = null;
  }

  isAuthenticated(): boolean {
    return Boolean(this.getToken());
  }
}
