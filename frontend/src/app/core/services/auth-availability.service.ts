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
    return this.checkHealthEndpoint_().pipe(
      timeout(AUTH_AVAILABILITY_TIMEOUT_MS),
      map(() => true),
      catchError((error: unknown) => of(this.mapAvailabilityFromError_(error))),
      tap((isAvailable) => this.available.set(isAvailable)),
      map(() => void 0)
    );
  }

  private toBaseUrl(path: string): string {
    const baseUrl = this.configService.environment.apiUrl;
    const sanitizedBase = baseUrl.replace(/\/+$/, '');
    return `${sanitizedBase}${path}`;
  }

  private checkHealthEndpoint_(): Observable<unknown> {
    return this.http.get<unknown>(this.toBaseUrl('/actuator/health/readiness')).pipe(
      catchError((error: unknown) => {
        // Для сумісності з середовищами, де readiness endpoint вимкнений.
        if (error instanceof HttpErrorResponse && error.status === 404) {
          return this.http.get<unknown>(this.toBaseUrl('/actuator/health'));
        }
        throw error;
      })
    );
  }

  private mapAvailabilityFromError_(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse)) {
      return false;
    }

    // Статус 0 означає, що бекенд недоступний або мережевий запит зірвався
    if (error.status === 0) {
      return false;
    }

    // Для health endpoint будь-який HTTP-статус (навіть 4xx/5xx) означає,
    // що бекенд досяжний, просто його стан не "UP".
    if (error.status > 0) {
      return true;
    }

    // Інші випадки трактуємо як недоступність auth-сервера
    return false;
  }
}
