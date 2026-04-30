import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { RoutesApiService } from '../../core/api/routes-api.service';
import { RoutePointContract, RouteSummaryContractDto } from '../../core/api/routes-contracts.model';

@Component({
  selector: 'app-routes',
  standalone: true,
  imports: [TranslateModule, MatCardModule, MatListModule, MatButtonModule, MatIconModule],
  templateUrl: './routes.component.html',
  styleUrl: './routes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoutesComponent {
  private readonly routesApi = inject(RoutesApiService);
  private readonly router = inject(Router);
  private readonly dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  readonly routeCards = signal<RouteCardViewModel[]>([]);
  readonly isLoading = signal(true);
  readonly loadFailed = signal(false);

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
    await this.router.navigate(['/freight-calculation'], { queryParams: { routeId } });
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
      points: [...points].sort((first: RoutePointContract, second: RoutePointContract) => first.order - second.order)
    };
  }
}

interface RouteCardViewModel {
  id: string;
  title: string;
  distanceKm: number | null;
  createdAt: string;
  points: RoutePointContract[];
}
