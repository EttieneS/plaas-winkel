import { Routes } from '@angular/router';
import { AUTH_ROUTES } from './routes/auth.routes';
import { SALES_ROUTES } from './routes/sales.routes';
import { MainLayout } from './components/layout/main-layout/main-layout';
import { requireAuth } from './auth/auth.guard';
import { USERS_ROUTES } from './routes/users.routes';
import { CATTLE_ROUTES } from './routes/cattle.routes';
import { SELL_ROUTES } from './routes/sell.routes';

export const routes: Routes = [
  { path: 'auth', children: AUTH_ROUTES },
  {
    path: 'sell',
    component: MainLayout,
    children: SELL_ROUTES,
    canActivate: [requireAuth],
    canActivateChild: [requireAuth],
  },
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
  {
    path: 'cattle',
    component: MainLayout,
    children: CATTLE_ROUTES,
    canActivate: [requireAuth],
    canActivateChild: [requireAuth],
  },
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },
];
