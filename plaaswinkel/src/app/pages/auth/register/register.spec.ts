import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';
import { environment } from '../../../../environments/environment';

describe('Unavailable registration', () => {
  beforeEach(() => {
    localStorage.removeItem(environment.tokenKey);
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    localStorage.removeItem(environment.tokenKey);
  });

  it('preserves the layout with disabled fields and a login link', async () => {
    const harness = await RouterTestingHarness.create('/auth/register');
    const page = harness.routeNativeElement!;
    expect(page.querySelector('[role="status"]')!.textContent).toContain(
      'Registration is not available yet',
    );
    for (const control of page.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLButtonElement
    >('input, select, button')) {
      expect(control.disabled).toBe(true);
    }
    expect(page.querySelector('a')!.getAttribute('href')).toBe('/auth/login');
  });

  for (const token of [null, 'existing-token']) {
    it(`does not create or change authentication on submission (token: ${token !== null})`, async () => {
      if (token) localStorage.setItem(environment.tokenKey, token);
      const harness = await RouterTestingHarness.create('/auth/register');
      const localBefore = JSON.stringify(localStorage);
      const sessionBefore = JSON.stringify(sessionStorage);
      harness
        .routeNativeElement!.querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await harness.fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe('/auth/register');
      expect(JSON.stringify(localStorage)).toBe(localBefore);
      expect(JSON.stringify(sessionStorage)).toBe(sessionBefore);
      TestBed.inject(HttpTestingController).expectNone(() => true);
    });
  }
});
