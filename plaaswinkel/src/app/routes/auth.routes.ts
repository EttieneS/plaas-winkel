import { Routes } from '@angular/router';
import { Login } from '../pages/auth/login/login';
import { Register } from '../pages/auth/register/register';

export const AUTH_ROUTES : Routes = [
    { path: 'login', component: Login },
    { path: 'register', component: Register }
];
