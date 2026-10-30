import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MyReservations } from './my-reservations';
import { UtilToastService } from '../../../services/util-toast.service';
import { environment } from '../../../../environments/environment';

describe('My Reservations', () => {
  const url = `${environment.apiBaseUrl}/api/cattle-sales/my-reservations`;
  const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  let http: HttpTestingController;
  const reservation = { id: 8, quantity_kg: '2.125', price_per_kg: '120.00', total_amount: '255.00',
    status: 'CONFIRMED', fulfilment_state: 'DELIVERED', fulfilled_at: '2026-10-01T12:00:00Z',
    created_at: '2026-09-30T12:00:00Z', sale: { id: 4, reference: 'CS-mine', status: 'FULFILLED',
      estimated_weight_kg: '20.000', committed_weight_kg: '20.000', percentage_committed: 100,
      fulfilment_due_at: null, ready_for_fulfilment_at: '2026-10-01T10:00:00Z' } };
  const pagination = { current_page: 1, last_page: 1, per_page: 25, total: 1 };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ imports: [MyReservations], providers: [provideHttpClient(),
      provideHttpClientTesting(), { provide: UtilToastService, useValue: toast }] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('renders server values, stage, progress and fulfilment without success toasts', () => {
    const fixture = TestBed.createComponent(MyReservations);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading your reservations');
    http.expectOne(`${url}?page=1`).flush({ success: true, message: 'OK', data: { reservations: [reservation], pagination } });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    for (const value of ['CS-mine', '2.125 kg', 'R120.00', 'R255.00', 'fulfilled', 'delivered', '20 / 20 kg committed', 'Not yet recorded']) {
      expect(text).toContain(value);
    }
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('shows empty history and refreshes', () => {
    const fixture = TestBed.createComponent(MyReservations);
    fixture.detectChanges();
    const empty = { reservations: [], pagination: { ...pagination, total: 0 } };
    http.expectOne(`${url}?page=1`).flush({ success: true, message: 'OK', data: empty });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('You have no cattle reservations yet.');
    fixture.nativeElement.querySelector('header button').click();
    http.expectOne(`${url}?page=1`).flush({ success: true, message: 'OK', data: empty });
  });

  it('normalizes failure once, hides stale data and retries the requested page', () => {
    const fixture = TestBed.createComponent(MyReservations);
    fixture.detectChanges();
    http.expectOne(`${url}?page=1`).flush({ success: true, message: 'OK', data: { reservations: [reservation],
      pagination: { ...pagination, last_page: 2, total: 26 } } });
    fixture.detectChanges();
    fixture.nativeElement.querySelector('nav button:last-child').click();
    http.expectOne(`${url}?page=2`).flush({ success: false, message: 'Reservations unavailable.', data: null },
      { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(toast.error).toHaveBeenCalledExactlyOnceWith('Reservations unavailable.');
    expect(fixture.nativeElement.querySelector('article')).toBeNull();
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    buttons.find(button => button.textContent!.includes('Retry'))!.click();
    http.expectOne(`${url}?page=2`).flush({ success: true, message: 'OK', data: { reservations: [reservation],
      pagination: { ...pagination, current_page: 2, last_page: 2, total: 26 } } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Page 2 of 2');
  });

  it('treats HTTP 200 application failure as failure', () => {
    const fixture = TestBed.createComponent(MyReservations);
    fixture.detectChanges();
    http.expectOne(`${url}?page=1`).flush({ success: false, message: 'Access denied.', data: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Your reservations could not be loaded.');
    expect(toast.error).toHaveBeenCalledExactlyOnceWith('Access denied.');
  });
});
