import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { ConfigService } from './config.service';
import { AuthState, AuthUser, LoginRequest, LoginResponse, RefreshResponse, UserRole } from '../../shared/models';

const AUTH_STORAGE_KEY = 'tms_geosun_auth';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly configService = inject(ConfigService);

  private readonly state = signal<AuthState>(this.loadInitialState());
  readonly user = computed(() => this.state().user);
  readonly accessToken = computed(() => this.state().accessToken);
  readonly isAuthenticated = computed(() => Boolean(this.state().accessToken && this.state().user));
  readonly roles = computed(() => this.state().user?.roles ?? []);

  private refreshInFlight$: Observable<string> | null = null;

  login(payload: LoginRequest): Observable<AuthUser> {
    return this.http.post<LoginResponse | ApiErrorEnvelope>(this.toApiUrl('/auth/login'), payload).pipe(
      map((response) => this.ensureSuccessResponse_(response)),
      tap((response) => this.setSession(response.accessToken, response.refreshToken, response.user)),
      map((response) => response.user)
    );
  }

  logout(): Observable<void> {
    const refreshToken = this.state().refreshToken;
    if (!refreshToken) {
      this.clearSession();
      return of(void 0);
    }

    return this.http.post<void | ApiErrorEnvelope>(this.toApiUrl('/auth/logout'), { refreshToken }).pipe(
      map((response) => this.ensureSuccessResponse_(response)),
      catchError(() => of(void 0)),
      tap(() => this.clearSession())
    );
  }

  getMe(): Observable<AuthUser> {
    return this.http.get<AuthUser | ApiErrorEnvelope>(this.toApiUrl('/auth/me')).pipe(
      map((response) => this.ensureSuccessResponse_(response)),
      tap((user) => this.setUser(user))
    );
  }

  hasAnyRole(allowedRoles: readonly UserRole[]): boolean {
    if (!allowedRoles.length) {
      return true;
    }

    const currentRoles = this.roles();
    return allowedRoles.some((role) => currentRoles.includes(role));
  }

  refreshAccessToken(): Observable<string> {
    const refreshToken = this.state().refreshToken;
    if (!refreshToken) {
      return throwError(() => new Error('Refresh token is missing'));
    }

    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }

    this.refreshInFlight$ = this.http.post<RefreshResponse | ApiErrorEnvelope>(this.toApiUrl('/auth/refresh'), { refreshToken }).pipe(
      map((response) => this.ensureSuccessResponse_(response)),
      tap((response) => this.setAccessToken(response.accessToken)),
      map((response) => response.accessToken),
      catchError((error) => {
        this.clearSession();
        return throwError(() => error);
      }),
      finalize(() => {
        this.refreshInFlight$ = null;
      }),
      shareReplay({ refCount: false, bufferSize: 1 })
    );

    return this.refreshInFlight$;
  }

  private setSession(accessToken: string, refreshToken: string, user: AuthUser): void {
    this.state.set({ accessToken, refreshToken, user });
    this.persistState();
  }

  private setUser(user: AuthUser): void {
    this.state.update((current) => ({ ...current, user }));
    this.persistState();
  }

  private setAccessToken(accessToken: string): void {
    this.state.update((current) => ({ ...current, accessToken }));
    this.persistState();
  }

  clearSession(): void {
    this.state.set({ accessToken: null, refreshToken: null, user: null });
    this.persistState();
  }

  private toApiUrl(path: string): string {
    const baseUrl = this.configService.environment.apiUrl;
    const sanitizedBase = baseUrl.replace(/\?+$/, '');
    return `${sanitizedBase}?route=${path}`;
  }

  private loadInitialState(): AuthState {
    if (typeof window === 'undefined') {
      return { accessToken: null, refreshToken: null, user: null };
    }

    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return { accessToken: null, refreshToken: null, user: null };
    }

    try {
      const parsed = JSON.parse(raw) as AuthState;
      return {
        accessToken: parsed.accessToken ?? null,
        refreshToken: parsed.refreshToken ?? null,
        user: parsed.user ?? null
      };
    } catch {
      return { accessToken: null, refreshToken: null, user: null };
    }
  }

  private persistState(): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.state()));
  }

  private ensureSuccessResponse_<T>(response: T | ApiErrorEnvelope): T {
    if (isApiErrorEnvelope_(response)) {
      throw new HttpErrorResponse({
        status: response.error.code,
        statusText: response.error.message,
        error: response.error
      });
    }
    return response;
  }
}

interface ApiErrorEnvelope {
  error: {
    code: number;
    message: string;
  };
}

function isApiErrorEnvelope_(value: unknown): value is ApiErrorEnvelope {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as { error?: { code?: unknown; message?: unknown } };
  return typeof candidate.error?.code === 'number' && typeof candidate.error?.message === 'string';
}
