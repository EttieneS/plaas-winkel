import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { UtilToastService } from '../services/util-toast.service';
import { environment } from '../../environments/environment';

describe('Authorization and session restoration', () => {
  const profile = { id: 1, name: 'Manager', email: 'manager@example.test',
    roles: ['FARMER'], permissions: ['users.view'] };
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem(environment.tokenKey);
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(), { provide: UtilToastService, useValue: {
          success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(),
        } }],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { http.verify(); localStorage.removeItem(environment.tokenKey); });

  function login(permissions: string[], roles = ['FARMER']): void {
    TestBed.inject(AuthService).login(profile.email, 'password').subscribe();
    http.expectOne(`${environment.apiBaseUrl}/api/auth/login`).flush({
      success: true, message: 'Login successful.',
      data: { token: 'token', user: { ...profile, roles, permissions } },
    });
  }

  it('restores roles and effective permissions with one shared bearer request', () => {
    localStorage.setItem(environment.tokenKey, 'token');
    const auth = TestBed.inject(AuthService);
    const first = vi.fn();
    const second = vi.fn();
    auth.ensureUser().subscribe(first);
    auth.ensureUser().subscribe(second);
    const request = http.expectOne(`${environment.apiBaseUrl}/api/auth/user`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    request.flush({ success: true, message: 'OK', data: profile });
    expect(first).toHaveBeenCalledWith(profile);
    expect(second).toHaveBeenCalledWith(profile);
    expect(auth.hasRole('FARMER')).toBe(true);
    expect(auth.hasRole('ADMIN')).toBe(false);
    expect(auth.hasPermission('users.view')).toBe(true);
    expect(auth.hasPermission('users.create')).toBe(false);
    expect(TestBed.inject(UtilToastService).success).not.toHaveBeenCalled();
    auth.logout();
    expect(auth.hasPermission('users.view')).toBe(false);
  });

  it('clears an expired session and preserves the backend rejection message', () => {
    localStorage.setItem(environment.tokenKey, 'expired');
    const auth = TestBed.inject(AuthService);
    const next = vi.fn();
    auth.ensureUser().subscribe(next);
    http.expectOne(`${environment.apiBaseUrl}/api/auth/user`).flush(
      { success: false, message: 'Your session has expired.', data: null },
      { status: 401, statusText: 'Unauthorized' },
    );
    expect(auth.isAuthenticated()).toBe(false);
    expect(next).toHaveBeenCalledWith(null);
    expect(TestBed.inject(UtilToastService).error).toHaveBeenCalledWith('Your session has expired.');
  });

  it('does not resurrect a logged-out user after an in-flight session response', () => {
    localStorage.setItem(environment.tokenKey, 'token');
    const auth = TestBed.inject(AuthService);
    auth.ensureUser().subscribe();
    const request = http.expectOne(`${environment.apiBaseUrl}/api/auth/user`);
    auth.logout();
    request.flush({ success: true, message: 'OK', data: profile });
    expect(auth.user()).toBeNull();
    expect(auth.hasPermission('users.view')).toBe(false);
  });

  for (const path of ['/users', '/users/create']) {
    it(`redirects unauthenticated direct access to ${path} to login`, async () => {
      await RouterTestingHarness.create(path);
      expect(TestBed.inject(Router).url).toBe('/auth/login');
    });

    it(`blocks direct access to ${path} without the required permissions`, async () => {
      login([]);
      const harness = await RouterTestingHarness.create(path);
      expect(TestBed.inject(Router).url).toBe('/sales/index');
      expect(harness.routeNativeElement!.querySelector('a[href="/users"]')).toBeNull();
      http.expectNone(`${environment.apiBaseUrl}/api/users`);
      http.expectNone(`${environment.apiBaseUrl}/api/roles`);
    });
  }

  it('allows the user index and drawer entry for users.view without exposing creation', async () => {
    login(['users.view']);
    const pending = RouterTestingHarness.create('/users');
    await vi.waitFor(() => {
      http.expectOne(`${environment.apiBaseUrl}/api/users?page=1`).flush({
        success: true, message: 'OK', data: {
          users: [profile], pagination: { current_page: 1, last_page: 1, per_page: 25, total: 1 },
        },
      });
    });
    const harness = await pending;
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/users');
    expect(harness.routeNativeElement!.querySelector('a[href="/users"]')).not.toBeNull();
    expect(harness.routeNativeElement!.querySelector('a[href="/users/create"]')).toBeNull();
    expect(harness.routeNativeElement!.textContent).toContain('FARMER');
  });

  it('blocks creation if role assignment permission is missing', async () => {
    login(['users.view', 'users.create', 'roles.view']);
    await RouterTestingHarness.create('/users/create');
    expect(TestBed.inject(Router).url).toBe('/sales/index');
    http.expectNone(`${environment.apiBaseUrl}/api/roles`);
  });

  it('does not grant feature access from the ADMIN role code alone', async () => {
    login([], ['ADMIN']);
    const harness = await RouterTestingHarness.create('/users');
    expect(TestBed.inject(AuthService).hasRole('ADMIN')).toBe(true);
    expect(TestBed.inject(AuthService).hasPermission('users.view')).toBe(false);
    expect(TestBed.inject(Router).url).toBe('/sales/index');
    expect(harness.routeNativeElement!.querySelector('a[href="/users"]')).toBeNull();
    http.expectNone(`${environment.apiBaseUrl}/api/users`);
  });

});
