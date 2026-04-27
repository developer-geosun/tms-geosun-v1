import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { switchMap, tap, timer } from 'rxjs';
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
  readonly lastCheckTime = signal<string>('--:--:--');

  constructor() {
    // Перевіряємо доступність auth-сервера одразу та кожні 10 секунд
    timer(0, 10_000)
      .pipe(
        tap(() => this.lastCheckTime.set(this.formatCurrentTime_())),
        switchMap(() => this.authAvailabilityService.checkOnStartup()),
        tap(() => {
          if (this.authAvailabilityService.isAvailable()) {
            void this.router.navigate(['/login']);
          }
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  private formatCurrentTime_(): string {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date());
  }
}

