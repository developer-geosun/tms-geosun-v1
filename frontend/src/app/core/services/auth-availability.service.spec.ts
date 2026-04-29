import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ConfigService } from './config.service';
import { AuthAvailabilityService } from './auth-availability.service';

describe('AuthAvailabilityService', () => {
  let service: AuthAvailabilityService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfigService, useValue: { environment: { apiUrl: '' } } }
      ]
    });

    service = TestBed.inject(AuthAvailabilityService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('sets availability true for successful readiness response', () => {
    service.checkOnStartup().subscribe();

    const request = httpMock.expectOne('/actuator/health/readiness');
    request.flush({ status: 'UP' });

    expect(service.isAvailable()).toBeTrue();
  });

  it('sets availability false when backend is down', () => {
    service.checkOnStartup().subscribe();

    const request = httpMock.expectOne('/actuator/health/readiness');
    request.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect(service.isAvailable()).toBeFalse();
  });

  it('sets availability true for proxy 5xx errors', () => {
    service.checkOnStartup().subscribe();

    const request = httpMock.expectOne('/actuator/health/readiness');
    request.flush({ message: 'Bad Gateway' }, { status: 502, statusText: 'Bad Gateway' });

    expect(service.isAvailable()).toBeTrue();
  });

  it('falls back to generic health endpoint when readiness returns 404', () => {
    service.checkOnStartup().subscribe();

    const readinessRequest = httpMock.expectOne('/actuator/health/readiness');
    readinessRequest.flush({ message: 'Not Found' }, { status: 404, statusText: 'Not Found' });

    const healthRequest = httpMock.expectOne('/actuator/health');
    healthRequest.flush({ status: 'UP' });

    expect(service.isAvailable()).toBeTrue();
  });

});
