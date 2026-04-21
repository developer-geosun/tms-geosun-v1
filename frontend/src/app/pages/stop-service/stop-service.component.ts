import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

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

}

