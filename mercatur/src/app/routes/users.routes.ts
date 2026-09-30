import { Routes } from '@angular/router';
import { requirePermissions } from '../auth/auth.guard';
import { Index } from '../pages/users/index/index';
import { Create } from '../pages/users/create/create';

export const USERS_ROUTES: Routes = [
  { path: '', component: Index, canActivate: [requirePermissions], data: { permissions: ['users.view'] } },
  { path: 'create', component: Create, canActivate: [requirePermissions],
    data: { permissions: ['users.create', 'roles.assign', 'roles.view'] } },
];
