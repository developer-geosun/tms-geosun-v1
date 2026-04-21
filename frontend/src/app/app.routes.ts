import { Routes } from '@angular/router';
import { serviceStopGuard } from './core/guards/service-stop.guard';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/main', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'main',
    canActivate: [serviceStopGuard, authGuard],
    data: { roles: ['admin', 'manager', 'user'] },
    loadComponent: () => import('./pages/main/main.component').then((m) => m.MainComponent)
  },
  {
    path: 'stop-service',
    loadComponent: () => import('./pages/stop-service/stop-service.component').then((m) => m.StopServiceComponent)
  },
  {
    path: '404',
    loadComponent: () => import('./pages/not-found/not-found.component').then((m) => m.NotFoundComponent)
  },
  { path: '**', redirectTo: '/404' }
];
