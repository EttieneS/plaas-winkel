import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MatProgressBar } from '@angular/material/progress-bar';
import { Index } from './index';
import { AuthService } from '../../../services/auth.service';
import { UtilToastService } from '../../../services/util-toast.service';
import { environment } from '../../../../environments/environment';

describe('Buyer cattle sales', () => {
  let fixture: ComponentFixture<Index>;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/api/cattle-sales`;
  const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const auth = { hasPermission: vi.fn(() => true) };
  const sale = { id: 4, reference: 'CS-from-api', estimated_weight_kg: '250.000', price_per_kg: '120.00',
    committed_weight_kg: '85.000', remaining_weight_kg: '165.000', available_weight_kg: '165.000',
    percentage_committed: 34, status: 'OPEN', description: null, can_reserve: true,
    created_at: '2026-09-30T10:00:00Z' };

  beforeEach(() => {
    vi.clearAllMocks();
    auth.hasPermission.mockReturnValue(true);
    TestBed.configureTestingModule({
      imports: [Index], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AuthService, useValue: auth }, { provide: UtilToastService, useValue: toast }],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Index);
  });

  afterEach(() => http.verify());

  function load(data = [sale]): void {
    fixture.detectChanges();
    const request = http.expectOne(`${base}/marketplace`);
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, message: 'OK', data });
    fixture.detectChanges();
  }

  function quantity(value: string): void {
    const input = fixture.nativeElement.querySelector('input');
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  function reserve(): void {
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  it('loads real allocation data and progress without demo packages', () => {
    load();
    expect(fixture.nativeElement.textContent).toContain('CS-from-api');
    expect(fixture.nativeElement.textContent).toContain('R120.00');
    expect(fixture.nativeElement.textContent).toContain('85 / 250 kg committed');
    expect(fixture.nativeElement.textContent).toContain('165');
    expect(fixture.debugElement.query(By.directive(MatProgressBar)).componentInstance.value).toBe(34);
    expect(fixture.nativeElement.textContent).not.toMatch(/demo|beef box/i);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('calculates informational estimated cost from entered kg and API price', () => {
    load();
    quantity('10');
    expect(fixture.nativeElement.textContent).toContain('R1,200.00');
    expect(fixture.nativeElement.textContent).toContain('Reserve 10 kg');
    quantity('7.5');
    expect(fixture.nativeElement.textContent).toContain('R900.00');
  });

  it('posts quantity only and refreshes allocation from the authoritative response', () => {
    load();
    quantity('10');
    reserve();
    const request = http.expectOne(`${base}/4/commitments`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ quantity_kg: 10 });
    request.flush({ success: true, message: '10 kg reserved successfully.', data: {
      commitment: { id: 9, quantity_kg: '10.000', price_per_kg: '120.00', total_amount: '1200.00', status: 'CONFIRMED' },
      sale: { ...sale, committed_weight_kg: '95.000', remaining_weight_kg: '155.000', available_weight_kg: '155.000', percentage_committed: 38 },
    } }, { status: 201, statusText: 'Created' });
    fixture.detectChanges();
    expect(toast.success).toHaveBeenCalledExactlyOnceWith('10 kg reserved successfully.');
    expect(fixture.nativeElement.textContent).toContain('95 / 250 kg committed');
    expect(fixture.nativeElement.textContent).toContain('155');
    expect(fixture.debugElement.query(By.directive(MatProgressBar)).componentInstance.value).toBe(38);
    expect(fixture.nativeElement.querySelector('input').value).toBe('');
  });

  it('removes reservation controls when the sale becomes fully committed', () => {
    load();
    quantity('165');
    reserve();
    http.expectOne(`${base}/4/commitments`).flush({ success: true, message: '165 kg reserved successfully.', data: {
      commitment: {}, sale: { ...sale, committed_weight_kg: '250.000', remaining_weight_kg: '0.000',
        available_weight_kg: '0.000', percentage_committed: 100, status: 'FULLY_COMMITTED', can_reserve: false },
    } });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('FULLY_COMMITTED');
    expect(fixture.debugElement.query(By.directive(MatProgressBar)).componentInstance.value).toBe(100);
  });

  it('keeps the quantity and uses the backend error through one red toast', () => {
    load();
    quantity('10');
    reserve();
    http.expectOne(`${base}/4/commitments`).flush({ success: false, message: 'Only 7.5 kg remains available.', data: null,
      errors: { quantity_kg: ['Only 7.5 kg remains available.'] } }, { status: 422, statusText: 'Unprocessable Entity' });
    fixture.detectChanges();
    expect(toast.error).toHaveBeenCalledExactlyOnceWith('Only 7.5 kg remains available.');
    expect(toast.success).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('input').value).toBe('10');
    expect(fixture.componentInstance.sales()[0].committed_weight_kg).toBe('85.000');
  });

  it('hides reservation controls when backend ownership or permission rejects them', () => {
    load([{ ...sale, can_reserve: false }]);
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('has no sample sales when the API is empty', () => {
    load([]);
    expect(fixture.nativeElement.querySelector('article')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('No cattle sales are available yet.');
  });

  it('does not fetch or expose buyer controls without view permission', () => {
    auth.hasPermission.mockReturnValue(false);
    fixture.detectChanges();
    http.expectNone(`${base}/marketplace`);
    expect(fixture.nativeElement.textContent).toContain('You do not have permission');
  });
});
