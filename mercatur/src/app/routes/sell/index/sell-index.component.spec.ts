import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { SellIndexComponent } from './sell-index.component';
import { UtilToastService } from '../../../services/util-toast.service';
import { environment } from '../../../../environments/environment';
import { routes } from '../../../app.routes';

describe('Sell product selector', () => {
  let fixture: ComponentFixture<SellIndexComponent>;
  let http: HttpTestingController;
  const url = `${environment.apiBaseUrl}/api/products`;
  const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [SellIndexComponent],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting(),
        { provide: UtilToastService, useValue: toast }],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SellIndexComponent);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  async function choose(name: string): Promise<void> {
    fixture.detectChanges();
    fixture.nativeElement.querySelector('mat-select').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const option = Array.from(document.querySelectorAll<HTMLElement>('mat-option'))
      .find((item) => item.textContent?.trim() === name)!;
    option.click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('navigates by API slug independently of ID or name to supported workflows', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    http.expectOne(url).flush({ success: true, message: 'OK', data: [
      { id: 97, name: 'Renamed cattle', slug: 'cattle', description: null },
      { id: 1, name: 'Seasonal greens', slug: 'cabbage', description: null },
      { id: 8, name: 'Apples', slug: 'apples', description: null },
    ] });
    await choose('Seasonal greens');
    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/sell', 'cabbage']);
    await choose('Apples');
    expect(toast.info).toHaveBeenCalledExactlyOnceWith('Apples: Coming soon');
    expect(navigate).toHaveBeenCalledTimes(1);
    await choose('Renamed cattle');
    expect(navigate).toHaveBeenLastCalledWith(['/sell', 'cattle']);
    expect(navigate).toHaveBeenCalledTimes(2);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('does not offer or navigate to cattle when the API does not return it', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    http.expectOne(url).flush({ success: true, message: 'OK', data: [
      { id: 1, name: 'Cabbage', slug: 'cabbage', description: null },
    ] });
    fixture.detectChanges();
    fixture.nativeElement.querySelector('mat-select').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(Array.from(document.querySelectorAll('mat-option')).map((option) => option.textContent?.trim()))
      .toEqual(['Cabbage']);
    fixture.componentInstance.selectProduct('cattle');
    fixture.detectChanges();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows an empty catalogue without supplying hard-coded options', () => {
    http.expectOne(url).flush({ success: true, message: 'OK', data: [] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No products are currently available');
    expect(fixture.nativeElement.querySelector('mat-select').getAttribute('aria-disabled')).toBe('true');
  });

  it('normalizes errors once and lets the user retry', () => {
    http.expectOne(url).flush({ success: false, message: 'Catalogue unavailable.', data: null },
      { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(toast.error).toHaveBeenCalledExactlyOnceWith('Catalogue unavailable.');
    expect(fixture.nativeElement.textContent).toContain('Products could not be loaded.');
    fixture.nativeElement.querySelector('button').click();
    http.expectOne(url).flush({ success: true, message: 'OK', data: [] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No products are currently available');
  });

  it('keeps a success false response in the failed UI state', () => {
    http.expectOne(url).flush({ success: false, message: 'Catalogue unavailable.', data: [] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Products could not be loaded.');
    expect(toast.error).toHaveBeenCalledExactlyOnceWith('Catalogue unavailable.');
  });
});
