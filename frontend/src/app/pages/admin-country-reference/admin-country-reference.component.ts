import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  ViewChild
} from '@angular/core';
import { MediaMatcher } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule, Sort } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CountryReferenceApiService, CountryReferenceContractDto } from '../../core/api';

@Component({
  selector: 'app-admin-country-reference',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatTooltipModule
  ],
  templateUrl: './admin-country-reference.component.html',
  styleUrl: './admin-country-reference.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminCountryReferenceComponent implements AfterViewInit {
  private static readonly MOBILE_MAX_WIDTH_PX = 600;
  private static readonly DESKTOP_DEFAULT_PAGE_SIZE = 10;
  private static readonly MOBILE_DEFAULT_PAGE_SIZE = 5;

  private readonly countryReferenceApi = inject(CountryReferenceApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly mediaMatcher = inject(MediaMatcher);
  private readonly destroyRef = inject(DestroyRef);

  readonly displayedColumns = ['codeAlpha2', 'codeAlpha3', 'nameUk', 'nameEn', 'nameRu'];
  readonly dataSource = new MatTableDataSource<CountryReferenceContractDto>([]);
  readonly pageSizeOptions = [5, 10, 15, 25, 50];
  readonly pageSize = signal(AdminCountryReferenceComponent.DESKTOP_DEFAULT_PAGE_SIZE);

  readonly isLoading = signal(false);
  readonly loadError = signal('');
  readonly countries = signal<CountryReferenceContractDto[]>([]);

  readonly searchForm = this.formBuilder.nonNullable.group({
    search: ['']
  });

  @ViewChild(MatPaginator) private paginator?: MatPaginator;
  @ViewChild(MatSort) private sort?: MatSort;

  constructor() {
    this.dataSource.sortData = this.sortCountries.bind(this);
    this.bindViewportPageSizeListener();
    this.searchForm.controls.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => void this.reload());
    void this.reload();
  }

  ngAfterViewInit(): void {
    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
    }
    if (this.sort) {
      this.dataSource.sort = this.sort;
    }
    this.applyDefaultPageSizeForViewport();
    this.refreshTableData();
  }

  async reload(): Promise<void> {
    this.isLoading.set(true);
    this.loadError.set('');
    try {
      const search = this.searchForm.controls.search.value.trim();
      const countries = await this.countryReferenceApi.list(search || undefined);
      this.countries.set(countries);
      this.refreshTableData();
    } catch {
      this.loadError.set('pages.adminCountryReference.loadFailed');
      this.countries.set([]);
      this.refreshTableData();
    } finally {
      this.isLoading.set(false);
    }
  }

  clearSearch(): void {
    this.searchForm.patchValue({ search: '' });
  }

  private bindViewportPageSizeListener(): void {
    const mql = this.mediaMatcher.matchMedia(
      `(max-width: ${AdminCountryReferenceComponent.MOBILE_MAX_WIDTH_PX}px)`
    );
    const onChange = (): void => this.applyDefaultPageSizeForViewport();
    onChange();
    mql.addEventListener('change', onChange);
    this.destroyRef.onDestroy(() => mql.removeEventListener('change', onChange));
  }

  private applyDefaultPageSizeForViewport(): void {
    const size = this.isMobileViewport()
      ? AdminCountryReferenceComponent.MOBILE_DEFAULT_PAGE_SIZE
      : AdminCountryReferenceComponent.DESKTOP_DEFAULT_PAGE_SIZE;
    this.pageSize.set(size);
    if (this.paginator) {
      this.paginator.pageSize = size;
      this.paginator.pageIndex = 0;
    }
  }

  private isMobileViewport(): boolean {
    return this.mediaMatcher.matchMedia(
      `(max-width: ${AdminCountryReferenceComponent.MOBILE_MAX_WIDTH_PX}px)`
    ).matches;
  }

  private refreshTableData(): void {
    this.dataSource.data = this.countries();
    this.paginator?.firstPage();
  }

  private sortCountries(data: CountryReferenceContractDto[], sort: Sort): CountryReferenceContractDto[] {
    if (!sort.active || sort.direction === '') {
      return data;
    }
    const direction = sort.direction === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => direction * this.compareSortValues(a, b, sort.active));
  }

  private compareSortValues(
    a: CountryReferenceContractDto,
    b: CountryReferenceContractDto,
    column: string
  ): number {
    switch (column) {
      case 'codeAlpha2':
        return a.codeAlpha2.localeCompare(b.codeAlpha2);
      case 'codeAlpha3':
        return a.codeAlpha3.localeCompare(b.codeAlpha3);
      case 'nameUk':
        return a.nameUk.localeCompare(b.nameUk, 'uk');
      case 'nameEn':
        return a.nameEn.localeCompare(b.nameEn);
      case 'nameRu':
        return a.nameRu.localeCompare(b.nameRu);
      default:
        return 0;
    }
  }
}
