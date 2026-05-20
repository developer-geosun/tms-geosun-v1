import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-admin-freight-scenario-ai-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, TranslateModule],
  template: `
    <h2 mat-dialog-title>{{ 'pages.adminFreightScenariosAi.confirmTitle' | translate }}</h2>
    <mat-dialog-content>
      <p>{{ data.messageKey | translate }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button type="button" (click)="close(false)">
        {{ 'pages.adminFreightScenariosAi.cancel' | translate }}
      </button>
      <button mat-flat-button color="warn" type="button" (click)="close(true)">
        {{ 'pages.adminFreightScenariosAi.confirm' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminFreightScenarioAiConfirmDialogComponent {
  readonly data = inject<{ messageKey: string }>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<AdminFreightScenarioAiConfirmDialogComponent>);

  close(confirmed: boolean): void {
    this.dialogRef.close(confirmed);
  }
}
