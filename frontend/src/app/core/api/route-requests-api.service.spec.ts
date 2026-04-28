import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BackendApiService } from './backend-api.service';
import { RouteRequestsApiService } from './route-requests-api.service';

describe('RouteRequestsApiService', () => {
  let service: RouteRequestsApiService;
  let httpMock: HttpTestingController;
  let backendApi: BackendApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(RouteRequestsApiService);
    httpMock = TestBed.inject(HttpTestingController);
    backendApi = TestBed.inject(BackendApiService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('creates route request via POST /route-requests', async () => {
    const payload = { routeId: 'r1' };
    const pending = service.createRouteRequest(payload as never);

    const request = httpMock.expectOne(backendApi.routeRequests);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush({ id: 'req-1' });

    await expectAsync(pending).toBeResolvedTo(jasmine.objectContaining({ id: 'req-1' }));
  });

  it('applies status query param for admin list', async () => {
    const pending = service.getAdminRouteRequests('NEW');

    const request = httpMock.expectOne((r) => r.url === backendApi.adminRouteRequests && r.params.get('status') === 'NEW');
    expect(request.request.method).toBe('GET');
    request.flush([]);

    await expectAsync(pending).toBeResolvedTo([]);
  });

  it('sends idempotency key header for createAdminQuote', async () => {
    const pending = service.createAdminQuote('req/1', {} as never, ' key-1 ');

    const request = httpMock.expectOne(`${backendApi.adminRouteRequests}/req%2F1/quotes`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('key-1');
    request.flush({ id: 'q1' });

    await expectAsync(pending).toBeResolvedTo(jasmine.objectContaining({ id: 'q1' }));
  });

  it('sends idempotency key header for sendAdminQuote', async () => {
    const pending = service.sendAdminQuote('quote/1', ' send-1 ');

    const request = httpMock.expectOne(`${backendApi.adminQuotes}/quote%2F1/send`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    expect(request.request.headers.get('Idempotency-Key')).toBe('send-1');
    request.flush({ id: 'quote/1', status: 'SENT' });

    await expectAsync(pending).toBeResolvedTo(jasmine.objectContaining({ id: 'quote/1', status: 'SENT' }));
  });
});
