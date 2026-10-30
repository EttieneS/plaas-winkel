import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Index } from './index';
import { AuthService } from '../../../services/auth.service';
import { UtilToastService } from '../../../services/util-toast.service';
import { environment } from '../../../../environments/environment';

describe('User index', () => {
  const error = vi.fn();
  let http: HttpTestingController;

  beforeEach(() => {
    error.mockReset();
    TestBed.configureTestingModule({ providers: [
      provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: UtilToastService, useValue: { error, success: vi.fn() } },
    ] });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(AuthService), 'hasPermissions').mockReturnValue(false);
  });

  afterEach(() => http.verify());

  it('renders users and roles safely and requests the next page', () => {
    const fixture = TestBed.createComponent(Index);
    fixture.detectChanges();
    http.expectOne(`${environment.apiBaseUrl}/api/users?page=1`).flush({
      success: true, message: 'OK', data: {
        users: [{ id: 1, name: '<img src=x>', email: 'one@example.test',
          roles: ['BUYER', 'FARMER'], permissions: [] }],
        pagination: { current_page: 1, last_page: 2, per_page: 25, total: 26 },
      },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('BUYER, FARMER');
    expect(fixture.nativeElement.textContent).toContain('<img src=x>');
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    fixture.componentInstance.load(2);
    http.expectOne(`${environment.apiBaseUrl}/api/users?page=2`).flush({
      success: true, message: 'OK', data: {
        users: [], pagination: { current_page: 2, last_page: 2, per_page: 25, total: 26 },
      },
    });
    expect(fixture.componentInstance.result()?.pagination.current_page).toBe(2);
  });

  it('displays a normalized failure and supports retry', () => {
    const fixture = TestBed.createComponent(Index);
    fixture.detectChanges();
    http.expectOne(`${environment.apiBaseUrl}/api/users?page=1`).flush(
      { success: false, message: 'Access to users was revoked.', data: null },
      { status: 403, statusText: 'Forbidden' },
    );
    expect(error).toHaveBeenCalledWith('Access to users was revoked.');
    expect(fixture.componentInstance.failed()).toBe(true);
    fixture.componentInstance.load();
    http.expectOne(`${environment.apiBaseUrl}/api/users?page=1`).flush({
      success: true, message: 'OK', data: {
        users: [], pagination: { current_page: 1, last_page: 1, per_page: 25, total: 0 },
      },
    });
    expect(fixture.componentInstance.failed()).toBe(false);
  });
});
