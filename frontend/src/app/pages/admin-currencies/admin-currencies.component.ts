import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule, Sort } from '@angular/material/sort';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CurrenciesApiService, CurrencyContractDto } from '../../core/api';

@Component({
  selector: 'app-admin-currencies',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    MatButtonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatSlideToggleModule,
    MatTooltipModule
  ],
  templateUrl: './admin-currencies.component.html',
  styleUrl: './admin-currencies.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminCurrenciesComponent implements AfterViewInit {
  private readonly currenciesApi = inject(CurrenciesApiService);

  readonly displayedColumns = [
    'code',
    'nameUk',
    'nbuUnits',
    'ratePerUnit',
    'rateDate',
    'isActive'
  ];
  readonly dataSource = new MatTableDataSource<CurrencyContractDto>([]);
  readonly pageSizeOptions = [5, 10, 15, 25, 50];
  readonly defaultPageSize = 10;

  readonly isLoading = signal(false);
  readonly isSyncing = signal(false);
  readonly loadError = signal('');
  readonly actionError = signal('');
  readonly actionSuccess = signal('');
  readonly currencies = signal<CurrencyContractDto[]>([]);
  readonly updatingCodes = signal<Set<string>>(new Set());

  @ViewChild(MatPaginator) private paginator?: MatPaginator;
  @ViewChild(MatSort) private sort?: MatSort;

  constructor() {
    this.dataSource.sortData = this.sortCurrencies.bind(this);
    void this.reload();
  }

  ngAfterViewInit(): void {
    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
    }
    if (this.sort) {
      this.dataSource.sort = this.sort;
    }
    this.refreshTableData();
  }

  async reload(): Promise<void> {
    this.isLoading.set(true);
    this.loadError.set('');
    try {
      const currencies = await this.currenciesApi.list(false);
      this.currencies.set(currencies);
      this.refreshTableData();
    } catch {
      this.loadError.set('pages.adminCurrencies.loadFailed');
      this.currencies.set([]);
      this.refreshTableData();
    } finally {
      this.isLoading.set(false);
    }
  }

  async syncNbuRates(): Promise<void> {
    this.isSyncing.set(true);
    this.actionError.set('');
    this.actionSuccess.set('');
    try {
      await this.currenciesApi.syncNbuRates();
      await this.reload();
      this.actionSuccess.set('pages.adminCurrencies.syncSuccess');
    } catch {
      this.actionError.set('pages.adminCurrencies.syncFailed');
    } finally {
      this.isSyncing.set(false);
    }
  }

  async toggleActive(row: CurrencyContractDto, isActive: boolean): Promise<void> {
    const code = row.code;
    this.updatingCodes.update((set) => new Set(set).add(code));
    this.actionError.set('');
    try {
      const updated = await this.currenciesApi.update(code, { isActive });
      this.currencies.update((list) =>
        list.map((item) => (item.code === code ? updated : item))
      );
      this.refreshTableData();
    } catch {
      this.actionError.set('pages.adminCurrencies.updateFailed');
    } finally {
      this.updatingCodes.update((set) => {
        const next = new Set(set);
        next.delete(code);
        return next;
      });
    }
  }

  isUpdating(code: string): boolean {
    return this.updatingCodes().has(code);
  }

  formatRate(value: number | null | undefined): string {
    if (value == null) {
      return '—';
    }
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  }

  private refreshTableData(): void {
    this.dataSource.data = this.currencies();
    this.paginator?.firstPage();
  }

  private sortCurrencies(data: CurrencyContractDto[], sort: Sort): CurrencyContractDto[] {
    if (!sort.active || sort.direction === '') {
      return data;
    }

    const direction = sort.direction === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => direction * this.compareSortValues(a, b, sort.active));
  }

  private compareSortValues(a: CurrencyContractDto, b: CurrencyContractDto, column: string): number {
    switch (column) {
      case 'code':
        return a.code.localeCompare(b.code);
      case 'nameUk':
        return a.nameUk.localeCompare(b.nameUk, 'uk');
      case 'ratePerUnit':
        return this.compareNullableNumbers(a.latestNbuRatePerUnit, b.latestNbuRatePerUnit);
      case 'isActive':
        return Number(a.isActive) - Number(b.isActive);
      default:
        return 0;
    }
  }

  private compareNullableNumbers(
    a: number | null | undefined,
    b: number | null | undefined
  ): number {
    if (a == null && b == null) {
      return 0;
    }
    if (a == null) {
      return 1;
    }
    if (b == null) {
      return -1;
    }
    return a - b;
  }
}
