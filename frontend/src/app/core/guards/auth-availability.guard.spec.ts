import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { authAvailabilityGuard } from './auth-availability.guard';
import { AuthAvailabilityService } from '../services';

describe('authAvailabilityGuard', () => {
  const createRoute = (path: string): ActivatedRouteSnapshot =>
    ({ routeConfig: { path } } as unknown as ActivatedRouteSnapshot);

  it('allows access when auth server is available', () => {
    const routerSpy = jasmine.createSpyObj<Router>('Router', ['createUrlTree']);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthAvailabilityService, useValue: { isAvailable: () => true } },
        { provide: Router, useValue: routerSpy }
      ]
    });

    const result = TestBed.runInInjectionContext(() => authAvailabilityGuard(createRoute('login'), {} as never));

    expect(result).toBeTrue();
    expect(routerSpy.createUrlTree).not.toHaveBeenCalled();
  });

  it('redirects to stop-service when auth server is unavailable', () => {
    const expectedTree = {} as UrlTree;
    const routerSpy = jasmine.createSpyObj<Router>('Router', ['createUrlTree']);
    routerSpy.createUrlTree.and.returnValue(expectedTree);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthAvailabilityService, useValue: { isAvailable: () => false } },
        { provide: Router, useValue: routerSpy }
      ]
    });

    const result = TestBed.runInInjectionContext(() => authAvailabilityGuard(createRoute('login'), {} as never));

    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/stop-service']);
    expect(result).toBe(expectedTree);
  });

  it('allows stop-service and 404 paths even when auth server is unavailable', () => {
    const routerSpy = jasmine.createSpyObj<Router>('Router', ['createUrlTree']);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthAvailabilityService, useValue: { isAvailable: () => false } },
        { provide: Router, useValue: routerSpy }
      ]
    });

    const stopServiceResult = TestBed.runInInjectionContext(() =>
      authAvailabilityGuard(createRoute('stop-service'), {} as never)
    );
    const notFoundResult = TestBed.runInInjectionContext(() =>
      authAvailabilityGuard(createRoute('404'), {} as never)
    );

    expect(stopServiceResult).toBeTrue();
    expect(notFoundResult).toBeTrue();
    expect(routerSpy.createUrlTree).not.toHaveBeenCalled();
  });
});
