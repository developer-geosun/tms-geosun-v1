import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule } from '@ngx-translate/core';

export interface RouteRequestFilterValues {
  status: string;
  createdFrom: string;
  createdTo: string;
  ownerEmail: string;
  routeTitle: string;
  sort: string;
  order: string;
}

export interface FilterRouteRequestsDialogData {
  filters: RouteRequestFilterValues;
  statusOptions: readonly string[];
}

export type FilterRouteRequestsDialogResult =
  | { action: 'apply'; values: RouteRequestFilterValues }
  | { action: 'reset' };

const DEFAULT_FILTERS: RouteRequestFilterValues = {
  status: '',
  createdFrom: '',
  createdTo: '',
  ownerEmail: '',
  routeTitle: '',
  sort: 'createdAt',
  order: 'desc'
};

@Component({
  selector: 'app-filter-route-requests-dialog',
  standalone: true,
  imports: [
    TranslateModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './filter-route-requests-dialog.component.html',
  styleUrl: './filter-route-requests-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FilterRouteRequestsDialogComponent {
  readonly data = inject<FilterRouteRequestsDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(
    MatDialogRef<FilterRouteRequestsDialogComponent, FilterRouteRequestsDialogResult>
  );
  private readonly formBuilder = inject(FormBuilder);

  readonly filterForm = this.formBuilder.nonNullable.group({
    status: [this.data.filters.status],
    createdFrom: [this.data.filters.createdFrom],
    createdTo: [this.data.filters.createdTo],
    ownerEmail: [this.data.filters.ownerEmail],
    routeTitle: [this.data.filters.routeTitle],
    sort: [this.data.filters.sort || DEFAULT_FILTERS.sort],
    order: [this.data.filters.order || DEFAULT_FILTERS.order]
  });

  cancel(): void {
    this.dialogRef.close();
  }

  apply(): void {
    this.dialogRef.close({
      action: 'apply',
      values: this.filterForm.getRawValue()
    });
  }

  reset(): void {
    this.filterForm.reset(DEFAULT_FILTERS);
    this.dialogRef.close({ action: 'reset' });
  }
}
