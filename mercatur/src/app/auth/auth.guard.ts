import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const requireAuth: CanActivateFn & CanActivateChildFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.ensureUser().pipe(map((user) =>
    user ? true : router.createUrlTree(['/auth/login']),
  ));
};

export const requirePermissions: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const permissions: string[] = route.data['permissions'] ?? [];
  return auth.ensureUser().pipe(map((user) =>
    !user ? router.createUrlTree(['/auth/login'])
      : auth.hasPermissions(permissions) || router.createUrlTree(['/sales/index']),
  ));
};
