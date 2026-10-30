import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../interfaces/api-response.interface';
import { CattleListing, CreateCattleListingRequest } from '../interfaces/cattle-listing.interface';
import { ApiFeedbackService } from './api-feedback.service';

@Injectable({ providedIn: 'root' })
export class CattleService {
  private readonly http = inject(HttpClient);
  private readonly feedback = inject(ApiFeedbackService);

  create(data: CreateCattleListingRequest): Observable<ApiResponse<CattleListing>> {
    return this.http.post<ApiResponse<CattleListing>>(
      `${environment.apiBaseUrl}/api/cattle`, data,
    ).pipe(this.feedback.forOperation<CattleListing>('Unable to create the cattle listing. Please try again.'));
  }
}
