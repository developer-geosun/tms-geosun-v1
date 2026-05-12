import { ChangeDetectionStrategy, Component, inject, LOCALE_ID, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { RoutesApiService } from '../../core/api/routes-api.service';
import { RoutePointContract, RouteSummaryContractDto } from '../../core/api/routes-contracts.model';
import { RouteDeleteConfirmDialogComponent, getRouteFreightRequestDialogConfig, RouteFreightRequestDialogComponent } from '../../shared/components';

@Component({
  selector: 'app-routes',
  standalone: true,
  imports: [TranslateModule, MatCardModule, MatListModule, MatButtonModule, MatIconModule, MatChipsModule],
  templateUrl: './routes.component.html',
  styleUrl: './routes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoutesComponent {
  private readonly routesApi = inject(RoutesApiService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly dateTimeFormatter = new Intl.DateTimeFormat(inject(LOCALE_ID), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  readonly routeCards = signal<RouteCardViewModel[]>([]);
  readonly isLoading = signal(true);
  readonly loadFailed = signal(false);
  readonly deletingRouteId = signal<string | null>(null);
  readonly deleteFailed = signal(false);
  readonly toastMessage = signal('');

  constructor() {
    void this.loadRouteCards();
  }

  formatRouteDateTime(isoDateTime: string | null | undefined): string {
    if (!isoDateTime) {
      return '';
    }

    const parsedDate = new Date(isoDateTime);
    if (Number.isNaN(parsedDate.getTime())) {
      return isoDateTime;
    }

    return this.dateTimeFormatter.format(parsedDate);
  }

  async openRoute(routeId: string): Promise<void> {
    await this.router.navigate(['/route-builder'], { queryParams: { routeId, mode: 'view' } });
  }

  async editRoute(routeId: string): Promise<void> {
    await this.router.navigate(['/route-builder'], { queryParams: { routeId, mode: 'edit' } });
  }

  /** Перехід у конструктор для створення нового маршруту. */
  async createNewRoute(): Promise<void> {
    await this.router.navigate(['/route-builder'], { queryParams: { mode: 'create' } });
  }

  async openFreightRequestDialog(route: RouteCardViewModel): Promise<void> {
    if (this.deletingRouteId()) {
      return;
    }
    const dialogRef = this.dialog.open(
      RouteFreightRequestDialogComponent,
      getRouteFreightRequestDialogConfig({
        routeId: route.id,
        createdAt: route.createdAt,
        updatedAt: route.updatedAt,
        pointsCount: route.points.length,
        distanceKm: route.distanceKm
      })
    );
    const submitted = await firstValueFrom(dialogRef.afterClosed());
    if (submitted) {
      this.showToast('pages.freightCalculation.success');
    }
  }

  async requestRouteDelete(
    routeId: string,
    routeTitle: string,
    routeCreatedAt: string | null | undefined,
    routeDistanceKm: number | null | undefined
  ): Promise<void> {
    if (this.deletingRouteId()) {
      return;
    }

    const dialogRef = this.dialog.open(RouteDeleteConfirmDialogComponent, {
      width: '420px',
      disableClose: true,
      data: {
        routeTitle,
        routeCreatedAt: this.formatRouteDateTime(routeCreatedAt),
        routeDistanceKm: routeDistanceKm?.toFixed(1) ?? '0.0'
      }
    });

    const shouldDelete = await firstValueFrom(dialogRef.afterClosed());
    if (!shouldDelete) {
      return;
    }

    await this.deleteRoute(routeId);
  }

  formatPointCoordinates(point: RoutePointContract): string {
    return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
  }

  async copyPointCoordinates(point: RoutePointContract): Promise<void> {
    const value = this.formatPointCoordinates(point);
    const isClipboardAvailable =
      typeof navigator !== 'undefined' &&
      'clipboard' in navigator &&
      typeof navigator.clipboard?.writeText === 'function';

    if (isClipboardAvailable) {
      try {
        await navigator.clipboard.writeText(value);
        this.showToast('pages.routeBuilder.coordinatesCopied');
        return;
      } catch {
        // Fall back to legacy clipboard API below.
      }
    }

    const copied = this.copyTextWithFallback(value);
    this.showToast(copied ? 'pages.routeBuilder.coordinatesCopied' : 'pages.routeBuilder.coordinatesCopyFailed');
  }

  private async loadRouteCards(): Promise<void> {
    this.isLoading.set(true);
    this.loadFailed.set(false);

    try {
      const summaries = await this.routesApi.getMyRoutes();
      const cards = await Promise.all(
        summaries.map(async (summary) => {
          try {
            const routeDetails = await this.routesApi.getMyRouteById(summary.id);
            return this.mapToCard(summary, routeDetails.points);
          } catch {
            return this.mapToCard(summary, []);
          }
        })
      );
      this.routeCards.set(cards);
    } catch {
      this.routeCards.set([]);
      this.loadFailed.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  private mapToCard(summary: RouteSummaryContractDto, points: RoutePointContract[]): RouteCardViewModel {
    return {
      id: summary.id,
      title: summary.title,
      distanceKm: summary.distanceKm,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
      lastOpenedAt: summary.lastOpenedAt,
      points: [...points].sort((first: RoutePointContract, second: RoutePointContract) => first.order - second.order)
    };
  }

  private async deleteRoute(routeId: string): Promise<void> {
    this.deleteFailed.set(false);
    this.deletingRouteId.set(routeId);
    try {
      await this.routesApi.deleteMyRoute(routeId);
      this.routeCards.update((currentCards) => currentCards.filter((card) => card.id !== routeId));
    } catch {
      this.deleteFailed.set(true);
    } finally {
      this.deletingRouteId.set(null);
    }
  }

  private showToast(key: string): void {
    this.toastMessage.set(key);
    setTimeout(() => this.toastMessage.set(''), 1800);
  }

  private copyTextWithFallback(value: string): boolean {
    if (typeof document === 'undefined') {
      return false;
    }
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
    document.body.removeChild(textarea);
    return copied;
  }
}

interface RouteCardViewModel {
  id: string;
  title: string;
  distanceKm: number | null;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  points: RoutePointContract[];
}
