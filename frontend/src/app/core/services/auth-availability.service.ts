import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, switchMap, tap, timeout, timer } from 'rxjs';
import { ConfigService } from './config.service';

const AUTH_AVAILABILITY_TIMEOUT_MS = 5000;

interface ActuatorHealthResponse {
  status?: string;
}

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
      map((response) => this.isHealthyResponse_(response)),
      catchError(() => of(false)),
      tap((isAvailable) => this.available.set(isAvailable)),
      map(() => void 0)
    );
  }

  // Періодична перевірка для guest-сторінок: редирект на stop-service, якщо бекенд недоступний
  startPollingWhileUnavailable(router: Router, destroyRef: DestroyRef, onCheck?: () => void): void {
    const pollIntervalMs = this.getPollIntervalMs_();
    if (pollIntervalMs === 0) {
      return;
    }

    timer(0, pollIntervalMs)
      .pipe(
        tap(() => onCheck?.()),
        switchMap(() => this.checkOnStartup()),
        tap(() => {
          if (!this.isAvailable()) {
            void router.navigate(['/stop-service']);
          }
        }),
        takeUntilDestroyed(destroyRef)
      )
      .subscribe();
  }

  // Періодична перевірка для stop-service: повернення на login, коли бекенд знову доступний
  startPollingWhileAvailable(
    router: Router,
    destroyRef: DestroyRef,
    redirectTo = '/login',
    onCheck?: () => void
  ): void {
    const pollIntervalMs = this.getPollIntervalMs_();
    if (pollIntervalMs === 0) {
      return;
    }

    timer(0, pollIntervalMs)
      .pipe(
        tap(() => onCheck?.()),
        switchMap(() => this.checkOnStartup()),
        tap(() => {
          if (this.isAvailable()) {
            void router.navigate([redirectTo]);
          }
        }),
        takeUntilDestroyed(destroyRef)
      )
      .subscribe();
  }

  private isHealthyResponse_(response: unknown): boolean {
    if (!response || typeof response !== 'object') {
      return false;
    }

    return (response as ActuatorHealthResponse).status === 'UP';
  }

  private toBaseUrl(path: string): string {
    const baseUrl = this.configService.environment.apiUrl;
    const sanitizedBase = baseUrl.replace(/\/+$/, '');
    return `${sanitizedBase}${path}`;
  }

  private checkHealthEndpoint_(): Observable<ActuatorHealthResponse> {
    return this.http.get<ActuatorHealthResponse>(this.toBaseUrl('/actuator/health/readiness')).pipe(
      catchError((error: unknown) => {
        // Для сумісності з середовищами, де readiness endpoint вимкнений.
        if (error instanceof HttpErrorResponse && error.status === 404) {
          return this.http.get<ActuatorHealthResponse>(this.toBaseUrl('/actuator/health'));
        }
        throw error;
      })
    );
  }

  private getPollIntervalMs_(): number {
    const intervalSeconds = this.configService.config.authAvailabilityPollIntervalSeconds;
    if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
      return 0;
    }

    return Math.floor(intervalSeconds * 1000);
  }
}
