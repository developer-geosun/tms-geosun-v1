import { HttpClient, HttpErrorResponse, HttpBackend } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap, timeout } from 'rxjs';
import { ConfigService } from './config.service';

const AUTH_AVAILABILITY_TIMEOUT_MS = 5000;

@Injectable({
  providedIn: 'root'
})
export class AuthAvailabilityService {
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly configService = inject(ConfigService);
  private readonly available = signal(true);

  isAvailable(): boolean {
    return this.available();
  }

  checkOnStartup(): Observable<void> {
    return this.http.get<unknown>(this.toApiUrl('/auth/me')).pipe(
      timeout(AUTH_AVAILABILITY_TIMEOUT_MS),
      map(() => true),
      catchError((error: unknown) => of(this.mapAvailabilityFromError_(error))),
      tap((isAvailable) => this.available.set(isAvailable)),
      map(() => void 0)
    );
  }

  private toApiUrl(path: string): string {
    const baseUrl = this.configService.environment.apiUrl;
    const sanitizedBase = baseUrl.replace(/\/+$/, '');
    return `${sanitizedBase}/api/v1${path}`;
  }

  private mapAvailabilityFromError_(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse)) {
      return false;
    }

    // Статус 0 означає, що бекенд недоступний або мережевий запит зірвався
    if (error.status === 0) {
      return false;
    }

    // 401/403 на /auth/me означають, що auth-сервер відповідає (немає сесії/прав)
    if (error.status === 401 || error.status === 403) {
      return true;
    }

    // Інші статуси (включно з 5xx від proxy) трактуємо як недоступність auth-сервера
    return false;
  }
}
