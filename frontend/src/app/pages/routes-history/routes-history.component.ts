import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { RoutesApiService } from '../../core/api/routes-api.service';
import { RouteSummaryContractDto } from '../../core/api/routes-contracts.model';

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

  constructor() {
    void this.loadRoutes();
  }

  async openRoute(routeId: string): Promise<void> {
    await this.router.navigate(['/freight-calculation'], { queryParams: { routeId } });
  }

  async backToCalculation(): Promise<void> {
    await this.router.navigate(['/freight-calculation']);
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

