import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { BackendApiService } from './backend-api.service';
import { CreateRouteRequestContractRequest, RouteRequestContractDto } from './route-requests-contracts.model';
import { CreateQuoteContractRequest, QuoteContractDto } from './quotes-contracts.model';

@Injectable({ providedIn: 'root' })
export class RouteRequestsApiService {
  private readonly http = inject(HttpClient);
  private readonly backendApi = inject(BackendApiService);

  async createRouteRequest(payload: CreateRouteRequestContractRequest): Promise<RouteRequestContractDto> {
    return firstValueFrom(this.http.post<RouteRequestContractDto>(this.backendApi.routeRequests, payload));
  }

  async getMyRouteRequests(): Promise<RouteRequestContractDto[]> {
    return firstValueFrom(this.http.get<RouteRequestContractDto[]>(this.backendApi.myRouteRequests));
  }

  async getMyRouteRequestById(requestId: number): Promise<RouteRequestContractDto> {
    return firstValueFrom(
      this.http.get<RouteRequestContractDto>(`${this.backendApi.myRouteRequests}/${encodeURIComponent(String(requestId))}`)
    );
  }

  async getAdminRouteRequests(status?: string): Promise<RouteRequestContractDto[]> {
    const params = status ? new HttpParams().set('status', status) : undefined;
    return firstValueFrom(this.http.get<RouteRequestContractDto[]>(this.backendApi.adminRouteRequests, { params }));
  }

  async getAdminRouteRequestById(requestId: number): Promise<RouteRequestContractDto> {
    return firstValueFrom(
      this.http.get<RouteRequestContractDto>(`${this.backendApi.adminRouteRequests}/${encodeURIComponent(String(requestId))}`)
    );
  }

  async createAdminQuote(
    requestId: number,
    payload: CreateQuoteContractRequest,
    idempotencyKey: string
  ): Promise<QuoteContractDto> {
    return firstValueFrom(
      this.http.post<QuoteContractDto>(
        `${this.backendApi.adminRouteRequests}/${encodeURIComponent(String(requestId))}/quotes`,
        payload,
        { headers: this.idempotencyHeaders(idempotencyKey) }
      )
    );
  }

  async sendAdminQuote(quoteId: string, idempotencyKey: string): Promise<QuoteContractDto> {
    return firstValueFrom(
      this.http.post<QuoteContractDto>(
        `${this.backendApi.adminQuotes}/${encodeURIComponent(quoteId)}/send`,
        null,
        { headers: this.idempotencyHeaders(idempotencyKey) }
      )
    );
  }

  async getAdminQuotesHistory(requestId: number): Promise<QuoteContractDto[]> {
    return firstValueFrom(
      this.http.get<QuoteContractDto[]>(
        `${this.backendApi.adminRouteRequests}/${encodeURIComponent(String(requestId))}/quotes`
      )
    );
  }

  async postAdminCountryBreakdown(requestId: number): Promise<RouteRequestContractDto> {
    return firstValueFrom(
      this.http.post<RouteRequestContractDto>(
        `${this.backendApi.adminRouteRequests}/${encodeURIComponent(String(requestId))}/country-breakdown`,
        null
      )
    );
  }

  private idempotencyHeaders(idempotencyKey: string): HttpHeaders {
    return new HttpHeaders({ 'Idempotency-Key': idempotencyKey.trim() });
  }
}
