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

  it('sets availability true for unauthorized response', () => {
    service.checkOnStartup().subscribe();

    const request = httpMock.expectOne('/api/v1/auth/me');
    request.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(service.isAvailable()).toBeTrue();
  });

  it('sets availability false when backend is down', () => {
    service.checkOnStartup().subscribe();

    const request = httpMock.expectOne('/api/v1/auth/me');
    request.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect(service.isAvailable()).toBeFalse();
  });

  it('sets availability false for proxy 5xx errors', () => {
    service.checkOnStartup().subscribe();

    const request = httpMock.expectOne('/api/v1/auth/me');
    request.flush({ message: 'Bad Gateway' }, { status: 502, statusText: 'Bad Gateway' });

    expect(service.isAvailable()).toBeFalse();
  });

});
