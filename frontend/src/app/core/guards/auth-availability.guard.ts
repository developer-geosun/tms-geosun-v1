import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthAvailabilityService } from '../services';

/**
 * Guard для редиректу на stop-service, якщо auth-сервер недоступний
 */
export const authAvailabilityGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot
): boolean | UrlTree => {
  const authAvailabilityService = inject(AuthAvailabilityService);
  const router = inject(Router);

  if (authAvailabilityService.isAvailable()) {
    return true;
  }

  const currentPath = route.routeConfig?.path ?? '';
  if (currentPath === 'stop-service' || currentPath === '404') {
    return true;
  }

  return router.createUrlTree(['/stop-service']);
};
