import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  CurrenciesApiService,
  CurrencyContractDto,
  NbuRatesSnapshotContractDto
} from '../../core/api';

@Component({
  selector: 'app-admin-currencies',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    MatButtonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSlideToggleModule,
    MatCheckboxModule,
    MatTooltipModule
  ],
  templateUrl: './admin-currencies.component.html',
  styleUrl: './admin-currencies.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminCurrenciesComponent {
  private readonly currenciesApi = inject(CurrenciesApiService);

  readonly displayedColumns = [
    'code',
    'nameUk',
    'nbuUnits',
    'ratePerUnit',
    'rateDate',
    'isActive'
  ];
  readonly isLoading = signal(false);
  readonly isSyncing = signal(false);
  readonly loadError = signal('');
  readonly actionError = signal('');
  readonly actionSuccess = signal('');
  readonly showActiveOnly = signal(false);
  readonly currencies = signal<CurrencyContractDto[]>([]);
  readonly nbuSnapshot = signal<NbuRatesSnapshotContractDto | null>(null);
  readonly updatingCodes = signal<Set<string>>(new Set());

  readonly pageIndex = signal(0);
  readonly pageSize = signal(15);
  readonly pageSizeOptions = [10, 15, 25, 50];

  readonly filteredCurrencies = computed(() => {
    const all = this.currencies();
    return this.showActiveOnly() ? all.filter((c) => c.isActive) : all;
  });

  readonly pagedCurrencies = computed(() => {
    const all = this.filteredCurrencies();
    const start = this.pageIndex() * this.pageSize();
    return all.slice(start, start + this.pageSize());
  });

  constructor() {
    void this.reload();
  }

  async reload(): Promise<void> {
    this.isLoading.set(true);
    this.loadError.set('');
    try {
      const [currencies, snapshot] = await Promise.all([
        this.currenciesApi.list(false),
        this.currenciesApi.getLatestNbuRates().catch(() => null)
      ]);
      this.currencies.set(currencies);
      this.nbuSnapshot.set(snapshot);
    } catch {
      this.loadError.set('pages.adminCurrencies.loadFailed');
      this.currencies.set([]);
      this.nbuSnapshot.set(null);
    } finally {
      this.isLoading.set(false);
    }
  }

  async syncNbuRates(): Promise<void> {
    this.isSyncing.set(true);
    this.actionError.set('');
    this.actionSuccess.set('');
    try {
      const result = await this.currenciesApi.syncNbuRates();
      this.nbuSnapshot.set({
        rateDate: result.rateDate,
        fetchedAt: result.fetchedAt,
        rates: result.rates
      });
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

  onActiveOnlyChange(checked: boolean): void {
    this.showActiveOnly.set(checked);
    this.pageIndex.set(0);
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
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
}
