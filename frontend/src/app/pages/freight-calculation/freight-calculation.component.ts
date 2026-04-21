import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Компонент сторінки розрахунку фрахту
 */
@Component({
  selector: 'app-freight-calculation',
  templateUrl: './freight-calculation.component.html',
  styleUrls: ['./freight-calculation.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [TranslateModule]
})
export class FreightCalculationComponent {}
