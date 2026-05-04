import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { RoutesApiService } from '../../core/api/routes-api.service';
import { RouteSummaryContractDto } from '../../core/api/routes-contracts.model';
import { RouteDeleteConfirmDialogComponent } from '../../shared/components';

@Component({
  selector: 'app-routes-history',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './routes-history.component.html',
  styleUrl: './routes-history.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoutesHistoryComponent {
  private readonly routesApi = inject(RoutesApiService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  readonly routes = signal<RouteSummaryContractDto[]>([]);
  readonly isLoading = signal(true);
  readonly loadFailed = signal(false);
  readonly deletingRouteId = signal<string | null>(null);
  readonly deleteFailed = signal(false);

  constructor() {
    void this.loadRoutes();
  }

  async openRoute(routeId: string): Promise<void> {
    await this.router.navigate(['/freight-calculation'], { queryParams: { routeId } });
  }

  async backToCalculation(): Promise<void> {
    await this.router.navigate(['/freight-calculation']);
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

    this.deleteFailed.set(false);
    this.deletingRouteId.set(routeId);
    try {
      await this.routesApi.deleteMyRoute(routeId);
      this.routes.update((currentRoutes) => currentRoutes.filter((route) => route.id !== routeId));
    } catch {
      this.deleteFailed.set(true);
    } finally {
      this.deletingRouteId.set(null);
    }
  }

  formatRouteDateTime(isoDateTime: string | null | undefined): string {
    if (!isoDateTime) {
      return '';
    }
    const parsed = new Date(isoDateTime);
    if (Number.isNaN(parsed.getTime())) {
      return isoDateTime;
    }
    return this.dateTimeFormatter.format(parsed);
  }

  private async loadRoutes(): Promise<void> {
    this.isLoading.set(true);
    this.loadFailed.set(false);
    try {
      this.routes.set(await this.routesApi.getMyRoutes());
    } catch {
      this.routes.set([]);
      this.loadFailed.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }
}

