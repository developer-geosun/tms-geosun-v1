import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Тонка обгортка для побудови URL backend API за contract-first підходом.
 * Мережеві виклики будуть додані у наступних фазах.
 */
@Injectable({
  providedIn: 'root'
})
export class BackendApiService {
  private readonly basePath = '/api/v1';
  private readonly baseUrl = (environment.apiUrl || '').replace(/\/+$/, '');

  get routes(): string {
    return this.build('/routes');
  }

  get myRoutes(): string {
    return this.build('/routes/my');
  }

  get routeRequests(): string {
    return this.build('/route-requests');
  }

  get myRouteRequests(): string {
    return this.build('/route-requests/my');
  }

  get adminRouteRequests(): string {
    return this.build('/admin/route-requests');
  }

  get adminQuotes(): string {
    return this.build('/admin/quotes');
  }

  get adminFreightScenarios(): string {
    return this.build('/admin/freight-calculation-scenarios');
  }

  get adminAiCalculations(): string {
    return this.build('/admin/ai-calculations');
  }

  private build(path: string): string {
    return `${this.baseUrl}${this.basePath}${path}`;
  }
}

