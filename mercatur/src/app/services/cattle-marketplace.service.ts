import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../interfaces/api-response.interface';
import { MarketplaceCattleSale, CattleSaleReservation } from '../interfaces/cattle-sale.interface';
import { ApiFeedbackService } from './api-feedback.service';

@Injectable({ providedIn: 'root' })
export class CattleMarketplaceService {
  private readonly http = inject(HttpClient);
  private readonly feedback = inject(ApiFeedbackService);
  private readonly url = `${environment.apiBaseUrl}/api/cattle-sales`;

  list(): Observable<ApiResponse<MarketplaceCattleSale[]>> {
    return this.http.get<ApiResponse<MarketplaceCattleSale[]>>(`${this.url}/marketplace`)
      .pipe(this.feedback.forOperation<MarketplaceCattleSale[]>('Unable to load cattle sales.', false));
  }

  get(id: number): Observable<ApiResponse<MarketplaceCattleSale>> {
    return this.http.get<ApiResponse<MarketplaceCattleSale>>(`${this.url}/${id}`)
      .pipe(this.feedback.forOperation<MarketplaceCattleSale>('Unable to load the cattle sale.', false));
  }

  reserve(id: number, quantity: number): Observable<ApiResponse<CattleSaleReservation>> {
    return this.http.post<ApiResponse<CattleSaleReservation>>(`${this.url}/${id}/commitments`, { quantity_kg: quantity })
      .pipe(this.feedback.forOperation<CattleSaleReservation>('Unable to reserve kilograms. Please try again.'));
  }
}
