import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Details } from './details';
import { AuthService } from '../../../services/auth.service';
import { UtilToastService } from '../../../services/util-toast.service';
import { environment } from '../../../../environments/environment';

describe('Buyer cattle sale details', () => {
  it('loads a real sale by route ID and hides fully committed reservation controls', () => {
    TestBed.configureTestingModule({ imports: [Details], providers: [provideRouter([]), provideHttpClient(),
      provideHttpClientTesting(), { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '7' })) } },
      { provide: AuthService, useValue: { hasPermission: () => true } },
      { provide: UtilToastService, useValue: { success: vi.fn(), error: vi.fn() } }],
    });
    const fixture = TestBed.createComponent(Details);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${environment.apiBaseUrl}/api/cattle-sales/7`).flush({ success: true, message: 'OK', data: {
      id: 7, reference: 'CS-real-detail', estimated_weight_kg: '250.000', price_per_kg: '120.00',
      committed_weight_kg: '250.000', remaining_weight_kg: '0.000', available_weight_kg: '0.000',
      percentage_committed: 100, status: 'FULLY_COMMITTED', description: null, can_reserve: false,
    } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('CS-real-detail');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    http.verify();
  });
});
