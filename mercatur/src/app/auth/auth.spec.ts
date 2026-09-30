import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';
import { Login } from '../pages/auth/login/login';
import { environment } from '../../environments/environment';
import { UtilToastService } from '../services/util-toast.service';

describe('API authentication', () => {
  let http: HttpTestingController;
  const loginUrl = `${environment.apiBaseUrl}/api/auth/login`;
  const response = {
    success: true,
    message: 'Login successful.',
    data: { token: 'test-token', user: { id: 1, name: 'Ettiene', email: 'ettiene@mercatur.test' } },
  };

  beforeEach(() => {
    localStorage.removeItem(environment.tokenKey);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem(environment.tokenKey);
  });

  it('posts entered credentials, stores the token, and redirects to sales', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const toast = vi.spyOn(TestBed.inject(UtilToastService), 'success');
    const fixture = TestBed.createComponent(Login);
    fixture.componentInstance.email = 'ettiene@mercatur.test';
    fixture.componentInstance.password = '12345';
    fixture.componentInstance.login();
    const request = http.expectOne(loginUrl);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'ettiene@mercatur.test', password: '12345' });
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(response);
    expect(localStorage.getItem(environment.tokenKey)).toBe('test-token');
    expect(TestBed.inject(AuthService).user()).toEqual(response.data.user);
    expect(navigate).toHaveBeenCalledWith(['/sales/index'], { replaceUrl: true });
    expect(toast).toHaveBeenCalledWith(
      'Login successful.',
    );
  });

  it('displays the backend error and does not authenticate after a rejected login', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    const toast = vi.spyOn(TestBed.inject(UtilToastService), 'error');
    const fixture = TestBed.createComponent(Login);
    fixture.componentInstance.login();
    http
      .expectOne(loginUrl)
      .flush(
        { success: false, message: 'Invalid email or password.', data: null },
        { status: 401, statusText: 'Unauthorized' },
      );
    fixture.detectChanges();
    expect(toast).toHaveBeenCalledWith(
      'Invalid email or password.',
    );
    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(false);
    expect(fixture.componentInstance.submitting()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not store authentication for an unsuccessful normalized response', () => {
    TestBed.inject(AuthService).login('test@example.com', 'wrong').subscribe();
    http.expectOne(loginUrl).flush({ success: false, message: 'Login failed.', data: null });
    expect(localStorage.getItem(environment.tokenKey)).toBeNull();
  });

  it('rejects a successful login response without a token and toasts the failure', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    const toast = vi.spyOn(TestBed.inject(UtilToastService), 'error');
    const fixture = TestBed.createComponent(Login);
    fixture.componentInstance.login();
    http.expectOne(loginUrl).flush({ success: true, message: 'OK', data: null });
    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(false);
    expect(fixture.componentInstance.submitting()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledExactlyOnceWith(
      'Unable to sign in. Please try again.',
    );
  });

  it('attaches the bearer token to Mercatur API requests', () => {
    localStorage.setItem(environment.tokenKey, 'test-token');
    const url = `${environment.apiBaseUrl}/api/auth/user`;
    TestBed.inject(HttpClient).get(url).subscribe();
    const request = http.expectOne(url);
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush({});
  });

  for (const url of [
    'https://example.com/api/user',
    'https://mercatur-api.test.evil.example/api/user',
    'https://mercatur-api.test/api-other',
    'http://mercatur-api.test/api/auth/user',
    '/assets/logo.svg',
  ]) {
    it(`does not attach the token to ${url}`, () => {
      localStorage.setItem(environment.tokenKey, 'test-token');
      TestBed.inject(HttpClient).get(url).subscribe();
      const request = http.expectOne(url);
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush({});
    });
  }

  it('clears the bearer token and user on local logout', () => {
    const service = TestBed.inject(AuthService);
    service.login('ettiene@mercatur.test', '12345').subscribe();
    http.expectOne(loginUrl).flush(response);
    service.logout();
    expect(service.getToken()).toBeNull();
    expect(service.user()).toBeNull();
  });
});
