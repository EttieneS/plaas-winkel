import { Routes } from '@angular/router';
import { AUTH_ROUTES } from './routes/auth.routes';
import { SALES_ROUTES } from './routes/sales.routes';
import { MainLayout } from './components/layout/main-layout/main-layout';
import { requireAuth } from './auth/auth.guard';
import { USERS_ROUTES } from './routes/users.routes';

export const routes: Routes = [
  { path: 'auth', children: AUTH_ROUTES },
  {
    path: 'sales',
    component: MainLayout,
    children: SALES_ROUTES,
    canActivate: [requireAuth],
    canActivateChild: [requireAuth],
  },
  {
    path: 'users',
    component: MainLayout,
    children: USERS_ROUTES,
    canActivate: [requireAuth],
    canActivateChild: [requireAuth],
  },
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },
];
