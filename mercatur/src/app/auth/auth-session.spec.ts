import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';
import { environment } from '../../environments/environment';

describe('API login and local logout', () => {
  beforeEach(() => {
    localStorage.removeItem(environment.tokenKey);
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    localStorage.removeItem(environment.tokenKey);
  });

  it('logs in through the API, logs out from details, and requires login again', async () => {
    const harness = await RouterTestingHarness.create('/auth/login');
    for (const [name, value] of [
      ['email', 'ettiene@mercatur.test'],
      ['password', '12345'],
    ]) {
      const input = harness.routeNativeElement!.querySelector<HTMLInputElement>(
        `[name="${name}"]`,
      )!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    harness
      .routeNativeElement!.querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    TestBed.inject(HttpTestingController)
      .expectOne(`${environment.apiBaseUrl}/api/auth/login`)
      .flush({
        success: true,
        message: 'Login successful.',
        data: {
          token: 'test-token',
          user: { id: 1, name: 'Ettiene', email: 'ettiene@mercatur.test' },
        },
      });
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/sales/index');
    expect(harness.routeNativeElement!.querySelector('app-topbar')!.textContent).toContain(
      'Ettiene',
    );

    await harness.navigateByUrl('/sales/1');
    const logout = Array.from(harness.routeNativeElement!.querySelectorAll('button')).find(
      (button) => button.getAttribute('aria-label') === 'Log out',
    )!;
    logout.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(false);
    expect(TestBed.inject(Router).url).toBe('/auth/login');

    for (const url of ['/sales/index', '/sales/1']) {
      await harness.navigateByUrl(url);
      expect(TestBed.inject(Router).url).toBe('/auth/login');
    }
  });
});
