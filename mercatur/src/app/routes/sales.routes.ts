import { Routes } from '@angular/router';
import { Index } from '../pages/sales/index/index';
import { Details } from '../pages/sales/details/details';

export const SALES_ROUTES: Routes = [
    { path: '', redirectTo: 'index', pathMatch: 'full' },
    { path: 'index', component: Index },
    { path: ':id', component: Details }
];
