import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../interfaces/api-response.interface';
import { Product } from '../interfaces/product.interface';
import { ApiFeedbackService } from './api-feedback.service';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly feedback = inject(ApiFeedbackService);

  list(): Observable<ApiResponse<Product[]>> {
    return this.http.get<ApiResponse<Product[]>>(`${environment.apiBaseUrl}/api/products`)
      .pipe(this.feedback.forOperation<Product[]>('Unable to load products. Please try again.', false));
  }
}
