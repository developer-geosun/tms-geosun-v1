import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { BackendApiService } from './backend-api.service';
import { CreateRouteRequestContractRequest, RouteRequestContractDto } from './route-requests-contracts.model';

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

  async getMyRouteRequestById(requestId: string): Promise<RouteRequestContractDto> {
    return firstValueFrom(
      this.http.get<RouteRequestContractDto>(`${this.backendApi.myRouteRequests}/${encodeURIComponent(requestId)}`)
    );
  }

  async getAdminRouteRequests(status?: string): Promise<RouteRequestContractDto[]> {
    const params = status ? new HttpParams().set('status', status) : undefined;
    return firstValueFrom(this.http.get<RouteRequestContractDto[]>(this.backendApi.adminRouteRequests, { params }));
  }

  async getAdminRouteRequestById(requestId: string): Promise<RouteRequestContractDto> {
    return firstValueFrom(
      this.http.get<RouteRequestContractDto>(`${this.backendApi.adminRouteRequests}/${encodeURIComponent(requestId)}`)
    );
  }
}
