import { Routes } from '@angular/router';
import { requirePermissions } from '../auth/auth.guard';
import { SellIndexComponent } from './sell/index/sell-index.component';
import { CattleIndexComponent } from './sell/cattle/index/cattle-index.component';
import { CabbageIndexComponent } from './sell/cabbage/index/cabbage-index.component';

export const SELL_ROUTES: Routes = [
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
