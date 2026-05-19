import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import {
  AdminRouteRequestListParams,
  CreateQuoteContractRequest,
  FreightAiCalculationContractDto,
  FreightAiCalculationSummaryContractDto,
  FreightAiCalculationsApiService,
  FreightScenariosApiService,
  QuoteContractDto,
  RouteRequestContractDto,
  RouteRequestsApiService,
  ScenarioContractDto
} from '../../core/api';
import { parseOptionalFormNumber } from '../../core/utils/parse-optional-form-number';
import {
  AiCalculationErrorDisplay,
  resolveAiCalculationError,
  resolveAiCalculationFailure
} from '../../core/utils/resolve-ai-calculation-error';
import * as L from 'leaflet';

@Component({
  selector: 'app-admin-route-requests',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatPaginatorModule,
    MatCardModule,
    MatExpansionModule
  ],
  templateUrl: './admin-route-requests.component.html',
  styleUrl: './admin-route-requests.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminRouteRequestsComponent implements AfterViewInit, OnDestroy {
  @ViewChild('requestMap', { static: false }) private readonly requestMapElement?: ElementRef<HTMLDivElement>;

  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly routeRequestsApi = inject(RouteRequestsApiService);
  private readonly scenariosApi = inject(FreightScenariosApiService);
  private readonly aiCalculationsApi = inject(FreightAiCalculationsApiService);
  private map: L.Map | null = null;
  private mapRouteLayer: L.Polyline | null = null;
  private mapMarkers: L.Marker[] = [];

  readonly isLoading = signal(false);
  readonly loadError = signal('');
  readonly requests = signal<RouteRequestContractDto[]>([]);
  readonly totalElements = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(20);
  readonly selectedRequestId = signal<number | null>(null);
  readonly quoteHistory = signal<QuoteContractDto[]>([]);
  readonly quoteLoadError = signal('');
  readonly isCreatingQuote = signal(false);
  readonly isSendingQuote = signal(false);
  readonly isCountryBreakdownLoading = signal(false);
  readonly quoteActionError = signal('');
  readonly quoteActionSuccess = signal('');

  readonly scenarios = signal<ScenarioContractDto[]>([]);
  readonly aiHistory = signal<FreightAiCalculationSummaryContractDto[]>([]);
  readonly aiResult = signal<FreightAiCalculationContractDto | null>(null);
  readonly isAiCalculating = signal(false);
  readonly aiErrorDisplay = signal<AiCalculationErrorDisplay | null>(null);

  readonly selectedRequest = computed(() =>
    this.requests().find((request) => request.id === this.selectedRequestId()) ?? null
  );
  readonly selectedDraftQuote = computed(
    () => this.quoteHistory().find((quote) => quote.status === 'draft') ?? null
  );

  readonly filterForm = this.formBuilder.nonNullable.group({
    status: [''],
    createdFrom: [''],
    createdTo: [''],
    ownerEmail: [''],
    routeTitle: [''],
    sort: ['createdAt'],
    order: ['desc']
  });

  readonly quoteDraftForm = this.formBuilder.nonNullable.group({
    currency: ['EUR'],
    totalAmount: [''],
    transitDaysMin: [''],
    transitDaysMax: [''],
    validUntil: [''],
    publicNote: [''],
    internalNote: ['']
  });

  readonly aiForm = this.formBuilder.nonNullable.group({
    scenarioId: [''],
    calculationDate: [new Date().toISOString().slice(0, 10)]
  });

  readonly statusOptions = ['new', 'in_review', 'quoted', 'accepted', 'rejected', 'cancelled', 'expired'];

  constructor() {
    void this.loadScenarios();
    void this.loadRequests();
    effect(() => {
      const request = this.selectedRequest();
      if (!request) {
        this.quoteHistory.set([]);
        this.aiHistory.set([]);
        this.aiResult.set(null);
        return;
      }
      queueMicrotask(() => {
        this.renderMapForRequest(request);
      });
      void this.loadQuoteHistory(request.id);
      void this.loadAiHistory(request.id);
    });
  }

  ngAfterViewInit(): void {
    this.initializeMap();
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = null;
  }

  async loadRequests(): Promise<void> {
    this.isLoading.set(true);
    this.loadError.set('');
    this.quoteActionError.set('');
    this.quoteActionSuccess.set('');
    try {
      const filters = this.filterForm.getRawValue();
      const params: AdminRouteRequestListParams = {
        status: filters.status || undefined,
        createdFrom: filters.createdFrom || undefined,
        createdTo: filters.createdTo || undefined,
        ownerEmail: filters.ownerEmail || undefined,
        routeTitle: filters.routeTitle || undefined,
        sort: filters.sort || 'createdAt',
        order: filters.order === 'asc' ? 'asc' : 'desc',
        page: this.pageIndex(),
        size: this.pageSize()
      };
      const page = await this.routeRequestsApi.getAdminRouteRequests(params);
      this.requests.set(page.content);
      this.totalElements.set(page.totalElements);
      const stillSelected = page.content.some((item) => item.id === this.selectedRequestId());
      if (!stillSelected) {
        this.selectedRequestId.set(page.content[0]?.id ?? null);
      }
    } catch {
      this.requests.set([]);
      this.selectedRequestId.set(null);
      this.totalElements.set(0);
      this.loadError.set('pages.adminRouteRequests.loadFailed');
    } finally {
      this.isLoading.set(false);
    }
  }

  async applyFilters(): Promise<void> {
    this.pageIndex.set(0);
    await this.loadRequests();
  }

  async resetFilters(): Promise<void> {
    this.filterForm.reset({
      status: '',
      createdFrom: '',
      createdTo: '',
      ownerEmail: '',
      routeTitle: '',
      sort: 'createdAt',
      order: 'desc'
    });
    this.pageIndex.set(0);
    await this.loadRequests();
  }

  async onPageChange(event: PageEvent): Promise<void> {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    await this.loadRequests();
  }

  selectRequest(requestId: number): void {
    this.selectedRequestId.set(requestId);
    this.quoteActionError.set('');
    this.quoteActionSuccess.set('');
    this.clearAiError();
    this.aiResult.set(null);
  }

  async createDraftQuote(): Promise<void> {
    const selected = this.selectedRequest();
    if (!selected) {
      return;
    }
    this.quoteActionError.set('');
    this.quoteActionSuccess.set('');
    const payload = this.toCreateQuotePayload();
    if (!payload) {
      this.quoteActionError.set('pages.adminRouteRequests.quoteValidationError');
      return;
    }

    this.isCreatingQuote.set(true);
    try {
      await this.routeRequestsApi.createAdminQuote(selected.id, payload, this.nextIdempotencyKey('create'));
      await this.loadRequests();
      this.quoteActionSuccess.set('pages.adminRouteRequests.quoteDraftCreated');
    } catch {
      this.quoteActionError.set('pages.adminRouteRequests.quoteCreateFailed');
    } finally {
      this.isCreatingQuote.set(false);
    }
  }

  async sendSelectedDraft(): Promise<void> {
    const draft = this.selectedDraftQuote();
    if (!draft) {
      return;
    }
    this.quoteActionError.set('');
    this.quoteActionSuccess.set('');
    this.isSendingQuote.set(true);
    try {
      await this.routeRequestsApi.sendAdminQuote(draft.id, this.nextIdempotencyKey('send'));
      await this.loadRequests();
      this.quoteActionSuccess.set('pages.adminRouteRequests.quoteSentSuccess');
    } catch {
      this.quoteActionError.set('pages.adminRouteRequests.quoteSendFailed');
    } finally {
      this.isSendingQuote.set(false);
    }
  }

  applyAiTotalToQuote(): void {
    const structured = this.aiResult()?.responseStructured;
    if (!structured) {
      return;
    }
    const total = structured['total'];
    const currency = structured['currency'];
    if (typeof total === 'number' && Number.isFinite(total)) {
      this.quoteDraftForm.patchValue({ totalAmount: String(total) });
    }
    if (typeof currency === 'string' && currency.trim()) {
      this.quoteDraftForm.patchValue({ currency: currency.trim().toUpperCase() });
    }
  }

  async runAiCalculation(): Promise<void> {
    const selected = this.selectedRequest();
    const scenarioId = this.aiForm.controls.scenarioId.value.trim();
    if (!selected || !scenarioId) {
      this.aiErrorDisplay.set({ messageKey: 'pages.adminRouteRequests.aiScenarioRequired' });
      return;
    }
    this.clearAiError();
    this.isAiCalculating.set(true);
    try {
      const result = await this.aiCalculationsApi.run(selected.id, {
        scenarioId,
        calculationDate: this.aiForm.controls.calculationDate.value || undefined
      });
      this.aiResult.set(result);
      await this.loadAiHistory(selected.id);
    } catch (error) {
      this.aiErrorDisplay.set(resolveAiCalculationError(error));
      await this.loadAiHistory(selected.id);
    } finally {
      this.isAiCalculating.set(false);
    }
  }

  async viewAiCalculation(calculationId: string): Promise<void> {
    this.clearAiError();
    try {
      const detail = await this.aiCalculationsApi.getById(calculationId);
      this.aiResult.set(detail);
    } catch (error) {
      this.aiErrorDisplay.set({
        messageKey: 'pages.adminRouteRequests.aiHistoryLoadFailed',
        detail: resolveAiCalculationError(error).detail
      });
    }
  }

  aiResultFailure(): AiCalculationErrorDisplay | null {
    const result = this.aiResult();
    if (!result || result.status !== 'FAILED') {
      return null;
    }
    return resolveAiCalculationFailure(result.errorMessage);
  }

  private clearAiError(): void {
    this.aiErrorDisplay.set(null);
  }

  async recalculateCountryBreakdown(): Promise<void> {
    const selected = this.selectedRequest();
    if (!selected) {
      return;
    }
    this.quoteActionError.set('');
    this.quoteActionSuccess.set('');
    this.isCountryBreakdownLoading.set(true);
    try {
      const updated = await this.routeRequestsApi.postAdminCountryBreakdown(selected.id);
      this.requests.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
      this.quoteActionSuccess.set('pages.adminRouteRequests.countryBreakdownSuccess');
    } catch {
      this.quoteActionError.set('pages.adminRouteRequests.countryBreakdownFailed');
    } finally {
      this.isCountryBreakdownLoading.set(false);
    }
  }

  async openScenariosPage(): Promise<void> {
    await this.router.navigate(['/admin/freight-calculation-scenarios']);
  }

  async backToMain(): Promise<void> {
    await this.router.navigate(['/main']);
  }

  aiStructuredJson(): string {
    const structured = this.aiResult()?.responseStructured;
    return structured ? JSON.stringify(structured, null, 2) : '';
  }

  private async loadScenarios(): Promise<void> {
    try {
      this.scenarios.set(await this.scenariosApi.list(true));
    } catch {
      this.scenarios.set([]);
    }
  }

  private async loadQuoteHistory(requestId: number): Promise<void> {
    this.quoteLoadError.set('');
    try {
      const history = await this.routeRequestsApi.getAdminQuotesHistory(requestId);
      this.quoteHistory.set(history);
    } catch {
      this.quoteHistory.set([]);
      this.quoteLoadError.set('pages.adminRouteRequests.quoteHistoryLoadFailed');
    }
  }

  private async loadAiHistory(requestId: number): Promise<void> {
    try {
      this.aiHistory.set(await this.aiCalculationsApi.listByRequest(requestId));
    } catch {
      this.aiHistory.set([]);
    }
  }

  private toCreateQuotePayload(): CreateQuoteContractRequest | null {
    const values = this.quoteDraftForm.getRawValue();
    const totalAmount = Number(values.totalAmount);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return null;
    }
    return {
      currency: values.currency.trim().toUpperCase() || 'EUR',
      totalAmount,
      transitDaysMin: parseOptionalFormNumber(values.transitDaysMin),
      transitDaysMax: parseOptionalFormNumber(values.transitDaysMax),
      validUntil: values.validUntil.trim() || null,
      publicNote: values.publicNote.trim() || null,
      internalNote: values.internalNote.trim() || null
    };
  }

  private nextIdempotencyKey(prefix: 'create' | 'send'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private initializeMap(): void {
    if (!this.requestMapElement || this.map) {
      return;
    }
    this.map = L.map(this.requestMapElement.nativeElement, { zoomControl: true }).setView([50.4501, 30.5234], 5);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; GeoSun'
    }).addTo(this.map);
    const selected = this.selectedRequest();
    if (selected) {
      this.renderMapForRequest(selected);
    }
  }

  private renderMapForRequest(request: RouteRequestContractDto): void {
    if (!this.map || !request.route) {
      return;
    }

    if (this.mapRouteLayer) {
      this.map.removeLayer(this.mapRouteLayer);
      this.mapRouteLayer = null;
    }
    this.mapMarkers.forEach((marker) => marker.remove());
    this.mapMarkers = [];

    const points = [...request.route.points].sort((a, b) => a.order - b.order);
    this.mapMarkers = points.map((point) =>
      L.marker([point.lat, point.lng]).addTo(this.map!).bindPopup(`${point.order}. ${point.address}`)
    );

    const latLngs = this.parseRoutePolyline(request.route.routePolyline, points);
    if (latLngs.length > 1) {
      this.mapRouteLayer = L.polyline(latLngs, { color: '#2563eb', weight: 4, opacity: 0.75 }).addTo(this.map);
      this.map.fitBounds(this.mapRouteLayer.getBounds(), { padding: [30, 30] });
      return;
    }

    if (this.mapMarkers.length) {
      const group = L.featureGroup(this.mapMarkers);
      this.map.fitBounds(group.getBounds(), { padding: [30, 30] });
    }
  }

  private parseRoutePolyline(routePolyline: string, points: { lat: number; lng: number }[]): L.LatLng[] {
    try {
      const parsed = JSON.parse(routePolyline) as [number, number][];
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => Array.isArray(item) && item.length === 2)
          .map((item) => L.latLng(item[0], item[1]));
      }
    } catch {
      // no-op
    }

    if (routePolyline.includes(';')) {
      return routePolyline
        .split(';')
        .map((chunk) => chunk.split(',').map((value) => Number(value.trim())))
        .filter((coords) => coords.length === 2 && Number.isFinite(coords[0]) && Number.isFinite(coords[1]))
        .map((coords) => L.latLng(coords[0], coords[1]));
    }

    return points.map((point) => L.latLng(point.lat, point.lng));
  }
}
