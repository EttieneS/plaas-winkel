import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../interfaces/api-response.interface';
import { CattleSale, CreateCattleSaleRequest, CattleSaleDetails, CattleStageEvidence, CattleFulfilmentAction } from '../interfaces/cattle-sale.interface';
import { ApiFeedbackService } from './api-feedback.service';

@Injectable({ providedIn: 'root' })
export class CattleSaleService {
  private readonly http = inject(HttpClient);
  private readonly feedback = inject(ApiFeedbackService);
  private readonly url = `${environment.apiBaseUrl}/api/cattle-sales`;

  list(): Observable<ApiResponse<CattleSale[]>> {
    return this.http.get<ApiResponse<CattleSale[]>>(this.url)
      .pipe(this.feedback.forOperation<CattleSale[]>('Unable to load cattle sales. Please try again.', false));
  }

  create(data: CreateCattleSaleRequest): Observable<ApiResponse<CattleSale>> {
    return this.http.post<ApiResponse<CattleSale>>(this.url, data)
      .pipe(this.feedback.forOperation<CattleSale>('Unable to create the cattle sale. Please try again.'));
  }

  details(id: number): Observable<ApiResponse<CattleSaleDetails>> {
    return this.http.get<ApiResponse<CattleSaleDetails>>(`${this.url}/${id}/fulfilment`)
      .pipe(this.feedback.forOperation<CattleSaleDetails>('Unable to load cattle sale details.', false));
  }

  transition(id: number, action: CattleFulfilmentAction, evidence?: CattleStageEvidence): Observable<ApiResponse<CattleSaleDetails>> {
    const paths: Record<CattleFulfilmentAction, string> = {
      ACCEPT: 'accept', RECORD_SLAUGHTER: 'slaughter', START_PROCESSING: 'processing', MARK_READY: 'ready',
    };
    return this.http.post<ApiResponse<CattleSaleDetails>>(`${this.url}/${id}/fulfilment/${paths[action]}`, evidence ?? {})
      .pipe(this.feedback.forOperation<CattleSaleDetails>('Unable to update cattle sale fulfilment.'));
  }

  fulfilReservation(id: number, reservationId: number, action: 'COLLECT' | 'DELIVER'): Observable<ApiResponse<CattleSaleDetails>> {
    const path = action === 'COLLECT' ? 'collect' : 'deliver';
    return this.http.post<ApiResponse<CattleSaleDetails>>(`${this.url}/${id}/fulfilment/reservations/${reservationId}/${path}`, {})
      .pipe(this.feedback.forOperation<CattleSaleDetails>('Unable to record reservation fulfilment.'));
  }
}
