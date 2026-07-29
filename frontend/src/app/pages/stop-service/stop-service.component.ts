import { ChangeDetectionStrategy, Component, DestroyRef, inject, LOCALE_ID, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthAvailabilityService } from '../../core/services';

/**
 * Компонент сторінки зупинки сервісу
 */
@Component({
  selector: 'app-stop-service',
  templateUrl: './stop-service.component.html',
  styleUrls: ['./stop-service.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [TranslateModule]
})
export class StopServiceComponent {
  private readonly authAvailabilityService = inject(AuthAvailabilityService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly localeId = inject(LOCALE_ID);
  readonly lastCheckTime = signal<string>('--:--:--');

  constructor() {
    this.authAvailabilityService.startPollingWhileAvailable(this.router, this.destroyRef, '/login', () =>
      this.updateLastCheckTime_()
    );
  }

  private updateLastCheckTime_(): void {
    this.lastCheckTime.set(
      new Intl.DateTimeFormat(this.localeId, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(new Date())
    );
  }
}
