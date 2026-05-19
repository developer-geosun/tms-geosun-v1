import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { BackendApiService } from './backend-api.service';
import {
  CreateScenarioContractRequest,
  ScenarioContractDto,
  UpdateScenarioContractRequest
} from './freight-scenarios-contracts.model';

@Injectable({ providedIn: 'root' })
export class FreightScenariosApiService {
  private readonly http = inject(HttpClient);
  private readonly backendApi = inject(BackendApiService);

  async list(activeOnly = false): Promise<ScenarioContractDto[]> {
    const params = new HttpParams().set('activeOnly', String(activeOnly));
    return firstValueFrom(this.http.get<ScenarioContractDto[]>(this.backendApi.adminFreightScenarios, { params }));
  }

  async getById(id: string): Promise<ScenarioContractDto> {
    return firstValueFrom(
      this.http.get<ScenarioContractDto>(`${this.backendApi.adminFreightScenarios}/${encodeURIComponent(id)}`)
    );
  }

  async create(payload: CreateScenarioContractRequest): Promise<ScenarioContractDto> {
    return firstValueFrom(this.http.post<ScenarioContractDto>(this.backendApi.adminFreightScenarios, payload));
  }

  async update(id: string, payload: UpdateScenarioContractRequest): Promise<ScenarioContractDto> {
    return firstValueFrom(
      this.http.put<ScenarioContractDto>(
        `${this.backendApi.adminFreightScenarios}/${encodeURIComponent(id)}`,
        payload
      )
    );
  }

  async delete(id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`${this.backendApi.adminFreightScenarios}/${encodeURIComponent(id)}`)
    );
  }

  async importFile(file: File, name?: string, description?: string): Promise<ScenarioContractDto> {
    const formData = new FormData();
    formData.append('file', file);
    if (name?.trim()) {
      formData.append('name', name.trim());
    }
    if (description?.trim()) {
      formData.append('description', description.trim());
    }
    return firstValueFrom(
      this.http.post<ScenarioContractDto>(`${this.backendApi.adminFreightScenarios}/import`, formData)
    );
  }
}
