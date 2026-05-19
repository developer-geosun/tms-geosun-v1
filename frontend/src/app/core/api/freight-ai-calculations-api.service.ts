import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { BackendApiService } from './backend-api.service';
import {
  FreightAiCalculationContractDto,
  FreightAiCalculationSummaryContractDto,
  RunAiCalculationContractRequest
} from './freight-ai-calculations-contracts.model';

@Injectable({ providedIn: 'root' })
export class FreightAiCalculationsApiService {
  private readonly http = inject(HttpClient);
  private readonly backendApi = inject(BackendApiService);

  async run(requestId: number, payload: RunAiCalculationContractRequest): Promise<FreightAiCalculationContractDto> {
    return firstValueFrom(
      this.http.post<FreightAiCalculationContractDto>(
        `${this.backendApi.adminRouteRequests}/${encodeURIComponent(String(requestId))}/ai-calculations`,
        payload
      )
    );
  }

  async listByRequest(requestId: number): Promise<FreightAiCalculationSummaryContractDto[]> {
    return firstValueFrom(
      this.http.get<FreightAiCalculationSummaryContractDto[]>(
        `${this.backendApi.adminRouteRequests}/${encodeURIComponent(String(requestId))}/ai-calculations`
      )
    );
  }

  async getById(calculationId: string): Promise<FreightAiCalculationContractDto> {
    return firstValueFrom(
      this.http.get<FreightAiCalculationContractDto>(
        `${this.backendApi.adminAiCalculations}/${encodeURIComponent(calculationId)}`
      )
    );
  }
}
