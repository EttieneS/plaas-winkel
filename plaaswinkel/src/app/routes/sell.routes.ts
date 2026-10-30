import { Routes } from '@angular/router';
import { requirePermissions } from '../auth/auth.guard';
import { SellIndexComponent } from './sell/index/sell-index.component';
import { CattleIndexComponent } from './sell/cattle/index/cattle-index.component';
import { CabbageIndexComponent } from './sell/cabbage/index/cabbage-index.component';

export const SELL_ROUTES: Routes = [
  {
    path: 'cattle/:id',
    loadComponent: () => import('../pages/sell/cattle/view/cattle-sale-details.component').then(m => m.CattleSaleDetailsComponent),
    canActivate: [requirePermissions],
    data: { permissions: ['cattle.manage'] },
  },
  {
    path: '',
    component: SellIndexComponent,
    canActivate: [requirePermissions],
    data: { permissions: ['cattle.create'] },
  },
  {
    path: 'cattle',
    component: CattleIndexComponent,
    canActivate: [requirePermissions],
    data: { permissions: ['cattle.create'] },
  },
  {
    path: 'cabbage',
    component: CabbageIndexComponent,
    canActivate: [requirePermissions],
    data: { permissions: ['cattle.create'] },
  },
];
