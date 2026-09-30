import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../interfaces/api-response.interface';
import { CattleSale, CreateCattleSaleRequest } from '../interfaces/cattle-sale.interface';
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
}
