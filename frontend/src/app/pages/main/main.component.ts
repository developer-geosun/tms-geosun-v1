import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';

/**
 * Компонент головної сторінки
 */
@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [TranslateModule]
})
export class MainComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.authService.user;
  readonly canSeeManagerSection = computed(() => this.authService.hasAnyRole(['admin', 'manager']));
  readonly canSeeAdminSection = computed(() => this.authService.hasAnyRole(['admin']));
  readonly canSeeFreightCalculationLink = computed(() => this.authService.hasAnyRole(['user']));

  openFreightCalculation(): void {
    this.router.navigate(['/freight-calculation']);
  }

  openFreightCalculationHere(): void {
    this.router.navigate(['/freight-calculation-here']);
  }
}

