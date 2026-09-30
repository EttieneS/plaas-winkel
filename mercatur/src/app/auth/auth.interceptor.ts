import { DOCUMENT, inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const apiUrl = new URL(environment.apiBaseUrl);
  const requestUrl = new URL(request.url, inject(DOCUMENT).baseURI);
  const apiPath = `${apiUrl.pathname.replace(/\/$/, '')}/api`;
  const isApiRequest =
    requestUrl.origin === apiUrl.origin &&
    (requestUrl.pathname === apiPath || requestUrl.pathname.startsWith(`${apiPath}/`));

  if (isApiRequest) {
    const token = inject(AuthService).getToken();
    if (token) {
      request = request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    }
  }

  return next(request);
};
