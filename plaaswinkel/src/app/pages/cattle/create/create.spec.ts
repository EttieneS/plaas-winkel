import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Create } from './create';
import { UtilToastService } from '../../../services/util-toast.service';
import { environment } from '../../../../environments/environment';

describe('Cattle creation', () => {
  let http: HttpTestingController;
  const success = vi.fn();
  const error = vi.fn();
  const warning = vi.fn();
  const payload = {
    title: 'Beef carcass', description: 'Grass-fed beef',
    carcass_weight_kg: 240, price_per_kg: 110,
  };
  const listing = {
    id: 7, farmer_id: 1, ...payload, carcass_weight_kg: '240.000',
    price_per_kg: '110.00', total_value: '26400.00', status: 'DRAFT',
    published_at: null, created_at: '2026-09-30T10:00:00Z', updated_at: '2026-09-30T10:00:00Z',
  };
  const url = `${environment.apiBaseUrl}/api/cattle`;

  beforeEach(() => {
    success.mockReset(); error.mockReset(); warning.mockReset();
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: UtilToastService, useValue: { success, error, warning, info: vi.fn() } },
    ] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function page() {
    const fixture = TestBed.createComponent(Create);
    fixture.detectChanges();
    return fixture;
  }

  it('updates the live estimate and submits only listing inputs through the service', () => {
    const fixture = page();
    fixture.componentInstance.form.setValue(payload);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.estimated-total').textContent).toBe('R26,400.00');
    fixture.componentInstance.form.controls.price_per_kg.setValue(120);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.estimated-total').textContent).toBe('R28,800.00');
    fixture.componentInstance.form.controls.price_per_kg.setValue(110);
    fixture.componentInstance.create();
    fixture.componentInstance.create();
    const request = http.expectOne(url);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    expect(request.request.body.farmer_id).toBeUndefined();
    expect(request.request.body.total_value).toBeUndefined();
    expect(request.request.body.status).toBeUndefined();
    request.flush({ success: true, message: 'Cattle listing created successfully.', data: listing },
      { status: 201, statusText: 'Created' });
    fixture.detectChanges();
    expect(success).toHaveBeenCalledExactlyOnceWith('Cattle listing created successfully.');
    expect(fixture.nativeElement.querySelector('.saved-listing').textContent).toContain('saved as a draft');
    expect(fixture.componentInstance.created()?.total_value).toBe('26400.00');
    expect(fixture.componentInstance.form.pristine).toBe(true);
    expect(fixture.componentInstance.submitting()).toBe(false);
  });

  it('uses the saved server value for confirmation rather than the browser estimate', () => {
    const fixture = page();
    fixture.componentInstance.form.setValue({ ...payload, carcass_weight_kg: 0.125, price_per_kg: 0.04 });
    fixture.componentInstance.create();
    http.expectOne(url).flush({ success: true, message: 'Cattle listing created successfully.',
      data: { ...listing, carcass_weight_kg: '0.125', price_per_kg: '0.04', total_value: '0.01' } });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.saved-listing').textContent).toContain('Total R0.01');
  });

  it('preserves inputs and displays normalized backend validation in the toast and field feedback', () => {
    const fixture = page();
    fixture.componentInstance.form.setValue(payload);
    fixture.componentInstance.create();
    http.expectOne(url).flush({
      success: false, message: 'Validation failed.', data: null,
      errors: { carcass_weight_kg: ['Carcass weight must be greater than 0 kg.'] },
    }, { status: 422, statusText: 'Unprocessable Entity' });
    fixture.detectChanges();
    expect(error).toHaveBeenCalledExactlyOnceWith('Validation failed. Carcass weight must be greater than 0 kg.');
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent)
      .toContain('Carcass weight must be greater than 0 kg.');
    expect(fixture.componentInstance.form.getRawValue()).toEqual(payload);
    expect(fixture.componentInstance.created()).toBeNull();
    expect(fixture.componentInstance.submitting()).toBe(false);
    expect(success).not.toHaveBeenCalled();
  });

  it.each([
    { title: ' ' }, { carcass_weight_kg: null }, { carcass_weight_kg: 0 },
    { carcass_weight_kg: -1 }, { carcass_weight_kg: 0.0001 },
    { carcass_weight_kg: 1000000 }, { price_per_kg: 0 },
    { price_per_kg: -1 }, { price_per_kg: 0.001 }, { price_per_kg: 1000000 },
  ])('rejects invalid form values without an HTTP request: %o', (changes) => {
    const fixture = page();
    fixture.componentInstance.form.setValue({ ...payload, ...changes });
    fixture.componentInstance.create();
    expect(warning).toHaveBeenCalledExactlyOnceWith('Please complete the listing with a title, valid weight and price.');
    http.expectNone(url);
  });

  it('allows an optional description and trims the title', () => {
    const fixture = page();
    fixture.componentInstance.form.setValue({ ...payload, title: '  Beef carcass  ', description: '' });
    fixture.componentInstance.create();
    const request = http.expectOne(url);
    expect(request.request.body).toEqual({ ...payload, description: null });
    request.flush({ success: true, message: 'Cattle listing created successfully.', data: listing });
  });

  it('preserves permission failures and allows retry without duplicate feedback', () => {
    const fixture = page();
    fixture.componentInstance.form.setValue(payload);
    fixture.componentInstance.create();
    http.expectOne(url).flush({
      success: false, message: 'You no longer have permission to create cattle listings.', data: null,
    }, { status: 403, statusText: 'Forbidden' });
    expect(error).toHaveBeenCalledExactlyOnceWith('You no longer have permission to create cattle listings.');
    expect(fixture.componentInstance.created()).toBeNull();
    expect(fixture.componentInstance.submitting()).toBe(false);
    fixture.componentInstance.create();
    http.expectOne(url).flush({ success: true, message: 'Cattle listing created successfully.', data: listing });
    expect(success).toHaveBeenCalledOnce();
  });

  it('does not treat an unsuccessful API envelope as a created listing', () => {
    const fixture = page();
    fixture.componentInstance.form.setValue(payload);
    fixture.componentInstance.create();
    http.expectOne(url).flush({ success: false, message: 'The listing could not be created.', data: null });
    expect(error).toHaveBeenCalledExactlyOnceWith('The listing could not be created.');
    expect(fixture.componentInstance.created()).toBeNull();
    expect(fixture.componentInstance.form.getRawValue()).toEqual(payload);
    expect(success).not.toHaveBeenCalled();
  });
});
