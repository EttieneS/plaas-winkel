import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { Create } from './create';
import { AuthService } from '../../../services/auth.service';
import { UtilToastService } from '../../../services/util-toast.service';
import { environment } from '../../../../environments/environment';

describe('User creation', () => {
  let http: HttpTestingController;
  const success = vi.fn();
  const error = vi.fn();
  const warning = vi.fn();
  const payload = {
    name: 'New User', email: 'new@example.test', password: 'strong-password',
    password_confirmation: 'strong-password', role_ids: [2, 3],
  };

  beforeEach(() => {
    success.mockReset(); error.mockReset(); warning.mockReset();
    TestBed.configureTestingModule({ providers: [
      provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: UtilToastService, useValue: { success, error, warning, info: vi.fn() } },
    ] });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(AuthService), 'hasPermission').mockReturnValue(true);
  });

  afterEach(() => http.verify());

  function createPage() {
    const fixture = TestBed.createComponent(Create);
    fixture.detectChanges();
    http.expectOne(`${environment.apiBaseUrl}/api/roles`).flush({
      success: true, message: 'OK', data: [
        { id: 2, name: 'Buyer', code: 'BUYER' }, { id: 3, name: 'Farmer', code: 'FARMER' },
      ],
    });
    fixture.detectChanges();
    return fixture;
  }

  it('loads available roles without a success toast and creates with multiple role IDs', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = createPage();
    expect(success).not.toHaveBeenCalled();
    expect(fixture.componentInstance.roles().map((role) => role.code)).toEqual(['BUYER', 'FARMER']);
    fixture.componentInstance.form.setValue(payload);
    fixture.componentInstance.create();
    fixture.componentInstance.create();
    const request = http.expectOne(`${environment.apiBaseUrl}/api/users`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush({ success: true, message: 'User created successfully.', data: {
      id: 2, name: 'New User', email: 'new@example.test', roles: ['BUYER', 'FARMER'], permissions: [],
    } }, { status: 201, statusText: 'Created' });
    expect(success).toHaveBeenCalledExactlyOnceWith('User created successfully.');
    expect(navigate).toHaveBeenCalledWith(['/users']);
    expect(fixture.componentInstance.submitting()).toBe(false);
  });

  it('uses normalized backend validation in both toast and field feedback without navigating', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    const fixture = createPage();
    fixture.componentInstance.form.setValue(payload);
    fixture.componentInstance.create();
    http.expectOne(`${environment.apiBaseUrl}/api/users`).flush({
      success: false, message: 'The email address is already registered.', data: null,
      errors: { email: ['The email address is already registered.'] },
    }, { status: 422, statusText: 'Unprocessable Entity' });
    fixture.detectChanges();
    expect(error).toHaveBeenCalledExactlyOnceWith('The email address is already registered.');
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent)
      .toContain('The email address is already registered.');
    expect(navigate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.submitting()).toBe(false);
    expect(fixture.componentInstance.form.getRawValue().email).toBe(payload.email);
  });

  it('warns on missing fields or a mismatched password without sending a request', () => {
    const fixture = createPage();
    fixture.componentInstance.create();
    expect(warning).toHaveBeenCalledWith('Please complete all required fields with valid values.');
    fixture.componentInstance.form.setValue({ ...payload, password_confirmation: 'different' });
    fixture.componentInstance.create();
    expect(warning).toHaveBeenCalledWith('The password confirmation does not match.');
    http.expectNone(`${environment.apiBaseUrl}/api/users`);
  });

  it('displays role-loading failures centrally and supports retry', () => {
    const fixture = TestBed.createComponent(Create);
    fixture.detectChanges();
    http.expectOne(`${environment.apiBaseUrl}/api/roles`).flush({
      success: false, message: 'You cannot assign roles.', data: null,
    }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(error).toHaveBeenCalledWith('You cannot assign roles.');
    expect(fixture.componentInstance.rolesFailed()).toBe(true);
    fixture.componentInstance.loadRoles();
    http.expectOne(`${environment.apiBaseUrl}/api/roles`).flush({
      success: true, message: 'OK', data: [],
    });
    expect(fixture.componentInstance.rolesFailed()).toBe(false);
  });
});
