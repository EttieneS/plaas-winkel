import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { CattleSaleDetailsComponent } from './cattle-sale-details.component';
import { AuthService } from '../../../../services/auth.service';
import { UtilToastService } from '../../../../services/util-toast.service';
import { CattleSaleDetails } from '../../../../interfaces/cattle-sale.interface';
import { environment } from '../../../../../environments/environment';

describe('Farmer cattle sale fulfilment details', () => {
  let fixture: ComponentFixture<CattleSaleDetailsComponent>;
  let http: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let routeMock: { snapshot: { paramMap: ReturnType<typeof convertToParamMap> }; paramMap: typeof params };
  const url = `${environment.apiBaseUrl}/api/cattle-sales/8/fulfilment`;
  const toast = { success: vi.fn(), error: vi.fn() };
  const permission = signal(true);
  const auth = { hasPermission: vi.fn(() => permission()) };
  const details: CattleSaleDetails = {
    id: 8, reference: 'CS-test', description: null, estimated_weight_kg: '10.000',
    committed_weight_kg: '10.000', available_weight_kg: '0.000', remaining_weight_kg: '0.000',
    price_per_kg: '900.00', status: 'TARGET_REACHED', target_reached_at: '2026-10-01T10:00:00Z',
    acceptance_due_at: '2026-10-03T10:00:00Z', accepted_at: null, sla_days: null,
    fulfilment_due_at: null, slaughtered_at: null, processing_started_at: null,
    ready_for_fulfilment_at: null, fulfilled_at: null, acceptance_overdue: true,
    fulfilment_overdue: false, fulfilment_seconds_remaining: null, permitted_actions: ['ACCEPT'],
    reservation_summary: { total: 1, unfulfilled: 1 },
    reservations: [{ id: 5, buyer_name: 'Customer A', quantity_kg: '0.125', price_per_kg: '10.04',
      total_amount: '1.26', status: 'CONFIRMED', fulfilment_state: 'UNFULFILLED', fulfilled_at: null, permitted_actions: [] }],
    traceability: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    permission.set(true);
    auth.hasPermission.mockImplementation(() => permission());
    params = new BehaviorSubject(convertToParamMap({ id: '8' }));
    routeMock = { snapshot: { paramMap: params.value }, paramMap: params };
    TestBed.configureTestingModule({
      imports: [CattleSaleDetailsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: ActivatedRoute, useValue: routeMock },
        { provide: AuthService, useValue: auth }, { provide: UtilToastService, useValue: toast }],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CattleSaleDetailsComponent);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  function load(data: CattleSaleDetails = structuredClone(details)): void {
    http.expectOne(url).flush({ success: true, message: 'OK', data });
    fixture.detectChanges();
  }

  it('displays backend SLA flags, operational reservations and their stored prices', () => {
    load();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Farmer acceptance is overdue');
    expect(text).toContain('Customer A');
    expect(text).toContain('R10.04');
    expect(text).toContain('R1.26');
    expect(text).toContain('R900.00');
    expect(text).not.toContain('Fulfilment SLA');
    expect(text).toContain('Accept Sale');
    expect(text).not.toContain('Record Slaughter');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('accepts through an explicit endpoint and replaces details with server deadlines', () => {
    load();
    fixture.componentInstance.act('ACCEPT');
    const request = http.expectOne(`${url}/accept`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    fixture.componentInstance.act('ACCEPT');
    http.expectNone(`${url}/accept`);
    request.flush({ success: true, message: 'Sale accepted.', data: { ...details, status: 'ACCEPTED',
      accepted_at: '2026-10-04T10:00:00Z', fulfilment_due_at: '2026-10-11T10:00:00Z', sla_days: 7,
      acceptance_overdue: false, fulfilment_seconds_remaining: 604800, permitted_actions: ['RECORD_SLAUGHTER'] } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Fulfilment SLA');
    expect(fixture.nativeElement.textContent).toContain('168 hours');
    expect(fixture.nativeElement.textContent).toContain('Record Slaughter');
    expect(toast.success).toHaveBeenCalledExactlyOnceWith('Sale accepted.');
  });

  it('retains traceability input on field validation errors and sends structured evidence', () => {
    load({ ...details, status: 'ACCEPTED', permitted_actions: ['RECORD_SLAUGHTER'] });
    fixture.componentInstance.act('RECORD_SLAUGHTER');
    fixture.detectChanges();
    const values = { occurred_at: '2026-10-04T12:00', processor_name: ' Abattoir A ',
      batch_reference: ' B-001 ', notes: ' Evidence notes ' };
    fixture.componentInstance.form.setValue(values);
    fixture.componentInstance.submitEvidence();
    const request = http.expectOne(`${url}/slaughter`);
    expect(request.request.body).toEqual({ occurred_at: new Date(values.occurred_at).toISOString(),
      processor_name: 'Abattoir A', batch_reference: 'B-001', notes: 'Evidence notes' });
    request.flush({ success: false, message: 'Validation failed.', data: null,
      errors: { batch_reference: ['Record the slaughter reference.'] } }, { status: 422, statusText: 'Unprocessable' });
    fixture.detectChanges();
    expect(fixture.componentInstance.form.getRawValue()).toEqual(values);
    expect(fixture.nativeElement.textContent).toContain('Record the slaughter reference.');
    expect(toast.error).toHaveBeenCalledExactlyOnceWith('Validation failed. Record the slaughter reference.');
    expect(fixture.componentInstance.sale()?.status).toBe('ACCEPTED');
  });

  it('uses processing and ready endpoints and displays preserved traceability and backend SLA satisfaction', () => {
    load({ ...details, status: 'SLAUGHTERED', permitted_actions: ['START_PROCESSING'] });
    fixture.componentInstance.act('START_PROCESSING');
    fixture.componentInstance.form.setValue({ occurred_at: '2026-10-04T12:00', processor_name: 'Butcher', batch_reference: 'P1', notes: '' });
    fixture.componentInstance.submitEvidence();
    http.expectOne(`${url}/processing`).flush({ success: true, message: 'Processing recorded.', data: {
      ...details, status: 'PROCESSING', accepted_at: '2026-10-04T10:00:00Z', fulfilment_overdue: true,
      permitted_actions: ['MARK_READY'], traceability: [{ id: 1, from_status: 'SLAUGHTERED', stage: 'PROCESSING',
        occurred_at: '2026-10-04T10:00:00Z', recorded_at: '2026-10-04T10:00:00Z',
        processor_name: 'Butcher', batch_reference: 'P1', notes: 'Evidence remains', reservation_id: null, fulfilment_state: null }] } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Fulfilment is overdue');
    expect(fixture.nativeElement.textContent).toContain('Evidence remains');
    fixture.componentInstance.act('MARK_READY');
    http.expectOne(`${url}/ready`).flush({ success: true, message: 'Meat ready.', data: { ...details,
      accepted_at: '2026-10-04T10:00:00Z', status: 'READY_FOR_FULFILMENT', ready_for_fulfilment_at: '2026-10-12T10:00:00Z',
      fulfilment_overdue: false, permitted_actions: [] } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Farmer SLA satisfied');
    expect(fixture.nativeElement.textContent).not.toContain('Fulfilment is overdue');
  });

  it.each(['COLLECT', 'DELIVER'] as const)('records %s and lets the backend determine final fulfilment', action => {
    const ready = { ...details, status: 'READY_FOR_FULFILMENT' as const, permitted_actions: [],
      reservations: [{ ...details.reservations[0], permitted_actions: ['COLLECT', 'DELIVER'] as ('COLLECT' | 'DELIVER')[] }] };
    load(ready);
    fixture.componentInstance.fulfil(ready.reservations[0], action);
    const request = http.expectOne(`${url}/reservations/5/${action === 'COLLECT' ? 'collect' : 'deliver'}`);
    expect(request.request.method).toBe('POST');
    request.flush({ success: true, message: 'Fulfilment recorded.', data: { ...ready, status: 'FULFILLED',
      fulfilled_at: '2026-10-13T10:00:00Z', reservation_summary: { total: 1, unfulfilled: 0 },
      reservations: [{ ...ready.reservations[0], fulfilment_state: action === 'COLLECT' ? 'COLLECTED' : 'DELIVERED', permitted_actions: [] }] } });
    fixture.detectChanges();
    expect(fixture.componentInstance.sale()?.status).toBe('FULFILLED');
    expect(fixture.nativeElement.textContent).not.toContain('Mark Collected');
    expect(toast.success).toHaveBeenCalledExactlyOnceWith('Fulfilment recorded.');
  });

  it('blocks unavailable actions and hides management controls without the central permission', () => {
    load();
    fixture.componentInstance.act('MARK_READY');
    http.expectNone(`${url}/ready`);
    permission.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Accept Sale');
    fixture.componentInstance.act('ACCEPT');
    http.expectNone(`${url}/accept`);
  });

  it('keeps displayed state on HTTP 200 application failure and shows one meaningful error toast', () => {
    load();
    fixture.componentInstance.act('ACCEPT');
    http.expectOne(`${url}/accept`).flush({ success: false, message: 'Acceptance rejected.', data: null });
    expect(fixture.componentInstance.sale()?.status).toBe('TARGET_REACHED');
    expect(toast.error).toHaveBeenCalledExactlyOnceWith('Acceptance rejected.');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('shows authorised load errors and supports retry', () => {
    http.expectOne(url).flush({ success: false, message: 'You may only manage your own cattle sales.', data: null },
      { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('could not be loaded');
    expect(toast.error).toHaveBeenCalledExactlyOnceWith('You may only manage your own cattle sales.');
    fixture.componentInstance.load();
    load();
  });

  it('cancels stale detail reads when navigating to another sale and clears previous evidence', () => {
    const first = http.expectOne(url);
    const nextParams = convertToParamMap({ id: '9' });
    routeMock.snapshot.paramMap = nextParams;
    params.next(nextParams);
    expect(first.cancelled).toBe(true);
    http.expectOne(`${environment.apiBaseUrl}/api/cattle-sales/9/fulfilment`).flush({
      success: true, message: 'OK', data: { ...details, id: 9, reference: 'CS-next' },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('CS-next');
    expect(fixture.nativeElement.textContent).not.toContain('CS-test');
    expect(fixture.componentInstance.evidenceAction()).toBeNull();
  });
});
