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

