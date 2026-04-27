import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { FreightRequestPayload } from './freight-calculation-here.models';

@Injectable({ providedIn: 'root' })
export class FreightRequestApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint =
    'https://script.google.com/macros/s/AKfycby-WfRfrQmG6jUVw3XxQSTXpfnNz2Eeg-TF30Vt0KTjgniFOIMXF_GkOEZAADJhBKyP/exec';

  async send(payload: FreightRequestPayload): Promise<void> {
    await firstValueFrom(this.http.post(this.endpoint, payload, { responseType: 'text' }));
  }
}
