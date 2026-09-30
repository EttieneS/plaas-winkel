import { Routes } from '@angular/router';
import { requirePermissions } from '../auth/auth.guard';
import { Create } from '../pages/cattle/create/create';

export const CATTLE_ROUTES: Routes = [
  {
    path: 'create',
    component: Create,
    canActivate: [requirePermissions],
    data: { permissions: ['cattle.create'] },
  },
];
