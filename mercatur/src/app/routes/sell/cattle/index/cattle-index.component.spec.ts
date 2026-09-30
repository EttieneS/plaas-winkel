import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { MatTable } from '@angular/material/table';
import { CattleIndexComponent } from './cattle-index.component';
import { UtilToastService } from '../../../../services/util-toast.service';
import { environment } from '../../../../../environments/environment';

describe('Cattle sales workspace', () => {
  let fixture: ComponentFixture<CattleIndexComponent>;
  let http: HttpTestingController;
  const url = `${environment.apiBaseUrl}/api/cattle-sales`;
  const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const sale = { id: 8, reference: 'CS-server-reference', owner_user_id: 4,
    estimated_weight_kg: '250.125', available_weight_kg: '250.125', price_per_kg: '110.50',
    description: 'Estimated beef', status: 'OPEN', created_at: '2026-09-30T10:00:00Z', updated_at: '2026-09-30T10:00:00Z' };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [CattleIndexComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: UtilToastService, useValue: toast }],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CattleIndexComponent);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function list(data: unknown[] = []): void {
    const request = http.expectOne(url);
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, message: 'OK', data });
    fixture.detectChanges();
  }

  function openAndFill(): void {
    fixture.nativeElement.querySelector('header button').click();
    fixture.detectChanges();
    fixture.componentInstance.form.setValue({ estimated_weight_kg: 250.125, price_per_kg: 110.5,
      description: ' Estimated beef ' });
    fixture.detectChanges();
  }

  function submit(): void {
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  it('loads only API sale rows into a Material table with rand formatting', () => {
    list([sale]);
    expect(fixture.debugElement.query(By.directive(MatTable))).not.toBeNull();
    const rows = fixture.nativeElement.querySelectorAll('tr.mat-mdc-row');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('CS-server-reference');
    expect(rows[0].textContent).toContain('250.125');
    expect(rows[0].textContent).toContain('R110.50');
    expect(rows[0].textContent).toContain('OPEN');
    expect(rows[0].querySelector('button').disabled).toBe(true);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('shows no demo rows when the API returns no sales and opens an inline form', () => {
    list();
    expect(fixture.nativeElement.querySelectorAll('td.mat-column-reference').length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('No cattle sales yet.');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    openAndFill();
    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Estimated sellable weight (kg)');
    expect(fixture.nativeElement.textContent).toContain("not the animal's live weight");
  });

  it('creates with intended fields, shows one success toast, resets and refreshes the table', () => {
    list();
    openAndFill();
    submit();
    const request = http.expectOne(url);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ estimated_weight_kg: 250.125, price_per_kg: 110.5, description: 'Estimated beef' });
    fixture.componentInstance.create();
    http.expectNone(url);
    request.flush({ success: true, message: 'Cattle sale created successfully.', data: sale },
      { status: 201, statusText: 'Created' });
    list([sale]);
    expect(toast.success).toHaveBeenCalledExactlyOnceWith('Cattle sale created successfully.');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.componentInstance.form.controls.estimated_weight_kg.value).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(sale.reference);
  });

  it('preserves values and surfaces backend validation through one existing error toast', () => {
    list();
    openAndFill();
    submit();
    http.expectOne(url).flush({ success: false, message: 'Validation failed.', data: null,
      errors: { estimated_weight_kg: ['Please check the estimated sellable weight.'] } },
      { status: 422, statusText: 'Unprocessable Entity' });
    fixture.detectChanges();
    expect(toast.error).toHaveBeenCalledExactlyOnceWith('Validation failed. Please check the estimated sellable weight.');
    expect(toast.success).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Please check the estimated sellable weight.');
    expect(fixture.componentInstance.form.getRawValue()).toEqual({ estimated_weight_kg: 250.125,
      price_per_kg: 110.5, description: ' Estimated beef ' });
    http.expectNone(url);
  });

  it('does not close or refresh on an application failure with HTTP 200', () => {
    list();
    openAndFill();
    submit();
    http.expectOne(url).flush({ success: false, message: 'Creation rejected.', data: null });
    fixture.detectChanges();
    expect(toast.error).toHaveBeenCalledExactlyOnceWith('Creation rejected.');
    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    http.expectNone(url);
  });

  it('prevents invalid submissions and resets on cancel', () => {
    list();
    openAndFill();
    fixture.componentInstance.form.controls.estimated_weight_kg.setValue(0);
    submit();
    http.expectNone(url);
    expect(fixture.nativeElement.textContent).toContain('Enter a positive weight');
    fixture.nativeElement.querySelector('form button[type="button"]').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.componentInstance.form.controls.price_per_kg.value).toBeNull();
  });

  it('shows list errors and supports retry without inventing rows', () => {
    http.expectOne(url).flush({ success: false, message: 'Sales unavailable.', data: null },
      { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(toast.error).toHaveBeenCalledExactlyOnceWith('Sales unavailable.');
    fixture.nativeElement.querySelector('button[mat-stroked-button]').click();
    list();
    expect(fixture.nativeElement.textContent).toContain('No cattle sales yet.');
  });
});
