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
    path: 'route-builder',
    canActivate: [authAvailabilityGuard, serviceStopGuard, authGuard],
    data: { roles: ['user'] },
    loadComponent: () => import('./pages/route-builder/route-builder.component').then((m) => m.RouteBuilderComponent)
  },
  {
    path: 'routes',
    canActivate: [authAvailabilityGuard, serviceStopGuard, authGuard],
    data: { roles: ['user'] },
    loadComponent: () => import('./pages/routes/routes.component').then((m) => m.RoutesComponent)
  },
  {
    path: 'my-freight-requests',
    canActivate: [authAvailabilityGuard, serviceStopGuard, authGuard],
    data: { roles: ['user'] },
    loadComponent: () =>
      import('./pages/my-freight-requests/my-freight-requests.component').then((m) => m.MyFreightRequestsComponent)
  },
  {
    path: 'admin/route-requests',
    canActivate: [authAvailabilityGuard, serviceStopGuard, authGuard],
    data: { roles: ['admin', 'manager'] },
    loadComponent: () =>
      import('./pages/admin-route-requests/admin-route-requests.component').then(
        (m) => m.AdminRouteRequestsComponent
      )
  },
  {
    path: 'admin/freight-calculation-scenarios',
    canActivate: [authAvailabilityGuard, serviceStopGuard, authGuard],
    data: { roles: ['admin', 'manager'] },
    loadComponent: () =>
      import('./pages/admin-freight-calculation-scenarios/admin-freight-calculation-scenarios.component').then(
        (m) => m.AdminFreightCalculationScenariosComponent
      )
  },
  {
    path: 'admin/freight-calculation-scenarios-ai',
    canActivate: [authAvailabilityGuard, serviceStopGuard, authGuard],
    data: { roles: ['admin', 'manager'] },
    loadComponent: () =>
      import('./pages/admin-freight-calculation-scenarios-ai/admin-freight-calculation-scenarios-ai.component').then(
        (m) => m.AdminFreightCalculationScenariosAiComponent
      )
  },
  {
    path: '404',
    loadComponent: () => import('./pages/not-found/not-found.component').then((m) => m.NotFoundComponent)
  },
  { path: '**', redirectTo: '/404' }
];
