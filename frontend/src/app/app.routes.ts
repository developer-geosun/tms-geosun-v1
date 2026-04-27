import { Routes } from '@angular/router';
import { serviceStopGuard } from './core/guards/service-stop.guard';
import { authGuard } from './core/guards/auth.guard';
import { authAvailabilityGuard } from './core/guards/auth-availability.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  {
    path: 'login',
    canActivate: [authAvailabilityGuard],
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'register',
    canActivate: [authAvailabilityGuard],
    loadComponent: () => import('./pages/register/register.component').then((m) => m.RegisterComponent)
  },
  {
    path: 'verify-email',
    canActivate: [authAvailabilityGuard],
    loadComponent: () =>
      import('./pages/verify-email/verify-email.component').then((m) => m.VerifyEmailComponent)
  },
  {
    path: 'main',
    canActivate: [authAvailabilityGuard, serviceStopGuard, authGuard],
    data: { roles: ['admin', 'manager', 'employee', 'user'] },
    loadComponent: () => import('./pages/main/main.component').then((m) => m.MainComponent)
  },
  {
    path: 'stop-service',
    loadComponent: () => import('./pages/stop-service/stop-service.component').then((m) => m.StopServiceComponent)
  },
  {
    path: 'freight-calculation',
    canActivate: [authAvailabilityGuard, serviceStopGuard, authGuard],
    data: { roles: ['user'] },
    loadComponent: () =>
      import('./pages/freight-calculation/freight-calculation.component').then((m) => m.FreightCalculationComponent)
  },
  {
    path: 'freight-calculation-here',
    canActivate: [authAvailabilityGuard, serviceStopGuard, authGuard],
    data: { roles: ['user'] },
    loadComponent: () =>
      import('./pages/freight-calculation-here/freight-calculation-here.component').then(
        (m) => m.FreightCalculationHereComponent
      )
  },
  {
    path: '404',
    loadComponent: () => import('./pages/not-found/not-found.component').then((m) => m.NotFoundComponent)
  },
  { path: '**', redirectTo: '/404' }
];
