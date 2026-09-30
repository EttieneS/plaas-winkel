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

  for (const path of ['/users', '/users/create', '/cattle/create', '/sell', '/sell/cattle', '/sell/cabbage', '/sales/1']) {
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

  for (const role of ['FARMER', 'ADMIN', 'BUSINESS']) {
    it(`allows Sell for ${role} and navigates to independent product workflows`, async () => {
      login(['cattle.create'], [role]);
      const pending = RouterTestingHarness.create('/sell');
      await vi.waitFor(() => {
        http.expectOne(`${environment.apiBaseUrl}/api/products`).flush({
          success: true, message: 'OK', data: [
            { id: 42, name: 'Renamed cattle', slug: 'cattle', description: null },
            { id: 1, name: 'Cabbage', slug: 'cabbage', description: null },
          ],
        });
      });
      const harness = await pending;
      harness.detectChanges();
      expect(harness.routeNativeElement!.querySelector('a[href="/sell"]')).not.toBeNull();
      harness.routeNativeElement!.querySelector<HTMLElement>('mat-select')!.click();
      harness.detectChanges();
      await harness.fixture.whenStable();
      const category = document.querySelector<HTMLElement>('mat-option')!;
      expect(category.textContent).toContain('Renamed cattle');
      category.click();
      await vi.waitFor(() => {
        http.expectOne(`${environment.apiBaseUrl}/api/cattle-sales`).flush({ success: true, message: 'OK', data: [] });
      });
      await harness.fixture.whenStable();
      harness.detectChanges();
      expect(TestBed.inject(Router).url).toBe('/sell/cattle');
      const page = harness.routeNativeElement!.querySelector('app-sell-cattle-index')!;
      expect(page.querySelector('h1')!.textContent).toBe('Cattle');
      expect(page.querySelector('button')!.textContent).toBe('Create Sale');
      expect(page.querySelector('button')!.disabled).toBe(false);
      expect(page.querySelector('form')).toBeNull();
      expect(harness.routeNativeElement!.querySelector('a[href="/sell/cattle"]')).toBeNull();
      const pendingEntry = harness.navigateByUrl('/sell');
      await vi.waitFor(() => {
        http.expectOne(`${environment.apiBaseUrl}/api/products`).flush({
          success: true, message: 'OK', data: [
            { id: 1, name: 'Cabbage', slug: 'cabbage', description: null },
          ],
        });
      });
      await pendingEntry;
      harness.detectChanges();
      harness.routeNativeElement!.querySelector<HTMLElement>('mat-select')!.click();
      harness.detectChanges();
      await harness.fixture.whenStable();
      Array.from(document.querySelectorAll<HTMLElement>('mat-option'))
        .find((option) => option.textContent?.trim() === 'Cabbage')!.click();
      await harness.fixture.whenStable();
      harness.detectChanges();
      expect(TestBed.inject(Router).url).toBe('/sell/cabbage');
      const cabbage = harness.routeNativeElement!.querySelector('app-sell-cabbage-index')!;
      expect(cabbage.querySelector('h1')!.textContent).toBe('Cabbage');
      expect(cabbage.querySelector('button')!.textContent).toBe('Add Cabbage Listing');
      expect(cabbage.querySelector('button')!.disabled).toBe(true);
      expect(cabbage.querySelector('form')).toBeNull();
      expect(harness.routeNativeElement!.querySelector('a[href="/sell/cabbage"]')).toBeNull();
      http.expectNone(`${environment.apiBaseUrl}/api/cattle`);
    });
  }

  for (const role of ['BUYER', 'FARMER', 'ADMIN']) {
    it(`hides Sell and blocks its workspace for ${role} without permission`, async () => {
      login([], [role]);
      const harness = await RouterTestingHarness.create('/sell');
      harness.detectChanges();
      expect(TestBed.inject(Router).url).toBe('/sales/index');
      expect(harness.routeNativeElement!.querySelector('a[href="/sell"]')).toBeNull();
    });
  }

  it('supports direct access to product workflows without loading the selector', async () => {
    login(['cattle.create']);
    const pending = RouterTestingHarness.create('/sell/cattle');
    await vi.waitFor(() => {
      http.expectOne(`${environment.apiBaseUrl}/api/cattle-sales`).flush({ success: true, message: 'OK', data: [] });
    });
    const harness = await pending;
    const router = TestBed.inject(Router);
    expect(router.url).toBe('/sell/cattle');
    await harness.navigateByUrl('/sell/cabbage');
    expect(router.url).toBe('/sell/cabbage');
    http.expectNone(`${environment.apiBaseUrl}/api/products`);
  });

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

  it('allows cattle creation and drawer visibility by permission even without a FARMER role', async () => {
    login(['cattle.create'], ['CUSTOM_SELLER']);
    const harness = await RouterTestingHarness.create('/cattle/create');
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/cattle/create');
    expect(harness.routeNativeElement!.querySelector('a[href="/sell"]')).not.toBeNull();
    expect(harness.routeNativeElement!.querySelector('a[href="/cattle/create"]')).toBeNull();
    expect(harness.routeNativeElement!.querySelector('app-cattle-create form')).not.toBeNull();
    expect(harness.routeNativeElement!.querySelector('a[href="/users"]')).toBeNull();
    http.expectNone(`${environment.apiBaseUrl}/api/cattle`);
  });

  it('allows buyer marketplace access without seller or user-management navigation', async () => {
    login(['cattle.view', 'cattle.reserve'], ['BUYER']);
    const pending = RouterTestingHarness.create('/sales/index');
    await vi.waitFor(() => {
      http.expectOne(`${environment.apiBaseUrl}/api/cattle-sales/marketplace`).flush({ success: true, message: 'OK', data: [] });
    });
    const harness = await pending;
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('a[href="/sales"]')).not.toBeNull();
    expect(harness.routeNativeElement!.querySelector('a[href="/sell"]')).toBeNull();
    expect(harness.routeNativeElement!.querySelector('a[href="/users"]')).toBeNull();
    expect(harness.routeNativeElement!.textContent).toContain('No cattle sales are available yet.');
  });

  it('hides the cattle drawer entry and blocks the route for FARMER without cattle.create', async () => {
    login([], ['FARMER']);
    const harness = await RouterTestingHarness.create('/cattle/create');
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/sales/index');
    expect(harness.routeNativeElement!.querySelector('a[href="/cattle/create"]')).toBeNull();
    http.expectNone(`${environment.apiBaseUrl}/api/cattle`);
  });

});
