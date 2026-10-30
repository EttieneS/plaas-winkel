import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../interfaces/api-response.interface';
import { User } from '../interfaces/user.interface';
import { Role } from '../interfaces/role.interface';
import { CreateUserRequest, UsersPage } from '../interfaces/users.interface';
import { ApiFeedbackService } from './api-feedback.service';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly feedback = inject(ApiFeedbackService);
  private readonly api = `${environment.apiBaseUrl}/api`;

  list(page = 1): Observable<ApiResponse<UsersPage>> {
    return this.http.get<ApiResponse<UsersPage>>(`${this.api}/users`, { params: { page } })
      .pipe(this.feedback.forOperation<UsersPage>('Unable to load users. Please try again.', false));
  }

  roles(): Observable<ApiResponse<Role[]>> {
    return this.http.get<ApiResponse<Role[]>>(`${this.api}/roles`)
      .pipe(this.feedback.forOperation<Role[]>('Unable to load roles. Please try again.', false));
  }

  create(data: CreateUserRequest): Observable<ApiResponse<User>> {
    return this.http.post<ApiResponse<User>>(`${this.api}/users`, data)
      .pipe(this.feedback.forOperation<User>('Unable to create the user. Please try again.'));
  }
}
