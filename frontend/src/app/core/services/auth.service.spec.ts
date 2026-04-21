import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { ConfigService } from './config.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfigService, useValue: { environment: { apiUrl: '/api' } } }
      ]
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('saves session after successful login', () => {
    let emittedEmail = '';
    service.login({ email: 'user@example.com', password: 'password123' }).subscribe((user) => {
      emittedEmail = user.email;
    });

    const request = httpMock.expectOne('/api?route=/auth/login');
    expect(request.request.method).toBe('POST');
    request.flush({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 900,
      user: {
        id: 'u1',
        email: 'user@example.com',
        roles: ['user']
      }
    });

    expect(emittedEmail).toBe('user@example.com');
    expect(service.isAuthenticated()).toBeTrue();
    expect(service.accessToken()).toBe('access-token');
  });

  it('clears session when refresh fails', () => {
    service.login({ email: 'user@example.com', password: 'password123' }).subscribe();
    httpMock.expectOne('/api?route=/auth/login').flush({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 900,
      user: {
        id: 'u1',
        email: 'user@example.com',
        roles: ['user']
      }
    });

    service.refreshAccessToken().subscribe({
      error: () => {}
    });
    httpMock.expectOne('/api?route=/auth/refresh').flush({ message: 'invalid' }, { status: 401, statusText: 'Unauthorized' });

    expect(service.isAuthenticated()).toBeFalse();
    expect(service.accessToken()).toBeNull();
  });

  it('treats API error envelope as failed login', () => {
    let status = 0;

    service.login({ email: 'user@example.com', password: 'password123' }).subscribe({
      error: (error: { status: number }) => {
        status = error.status;
      }
    });

    httpMock.expectOne('/api?route=/auth/login').flush({
      error: {
        code: 401,
        message: 'Invalid email or password'
      }
    });

    expect(status).toBe(401);
    expect(service.isAuthenticated()).toBeFalse();
  });
});
