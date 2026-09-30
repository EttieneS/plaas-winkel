import { Routes } from '@angular/router';
import { Index } from '../pages/sales/index/index';
import { Details } from '../pages/sales/details/details';
import { requirePermissions } from '../auth/auth.guard';

export const SALES_ROUTES: Routes = [
    { path: '', redirectTo: 'index', pathMatch: 'full' },
    { path: 'index', component: Index },
    { path: ':id', component: Details, canActivate: [requirePermissions], data: { permissions: ['cattle.view'] } }
];
