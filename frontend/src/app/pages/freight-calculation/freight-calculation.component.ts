import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import * as L from 'leaflet';
import {
  CreateRouteRequestContractRequest,
  BackendApiService,
  RoutePointContract,
  RouteSnapshotContractDto,
  RouteSummaryContractDto
} from '../../core/api';
import { RouteRequestsApiService } from '../../core/api/route-requests-api.service';
import { parseOptionalFormNumber } from '../../core/utils/parse-optional-form-number';
import { CHECKPOINTS_DATA } from '../../shared/constants/border-checkpoints.data';
import { Checkpoint, FreightLang, Waypoint } from './freight-calculation.models';
import { hasPendingBorderCheckpoint } from './freight-calculation.utils';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-freight-calculation',
  templateUrl: './freight-calculation.component.html',
  styleUrls: ['./freight-calculation.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, TranslateModule, ReactiveFormsModule, MatExpansionModule, MatFormFieldModule, MatSelectModule]
})
export class FreightCalculationComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) private readonly mapContainer!: ElementRef<HTMLDivElement>;

  private readonly formBuilder = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly backendApi = inject(BackendApiService);
  private readonly routeRequestsApi = inject(RouteRequestsApiService);
  private readonly translate = inject(TranslateService);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly waypoints = signal<Waypoint[]>([]);
  readonly segmentDistances = signal<number[]>([]);
  readonly searchResults = signal<NominatimResult[]>([]);
  readonly highlightedSearchIndex = signal(-1);
  readonly selectedWaypointIndex = signal<number | null>(null);
  readonly selectedCountryBySegment = signal<Record<number, string | null>>({});
  readonly requestOpen = signal(false);
  readonly isSearching = signal(false);
  readonly isSubmitting = signal(false);
  readonly isSavingRoute = signal(false);
  readonly isLoadingSavedRoute = signal(false);
  readonly myRoutes = signal<RouteSummaryContractDto[]>([]);
  readonly toastMessage = signal('');
  readonly dropdownSegmentIndex = signal<number | null>(null);
  /** Порожнє значення другого mat-select після вибору КПП або зміни країни */
  readonly borderCheckpointSelectValue = signal<Record<number, string>>({});

  readonly requestForm = this.formBuilder.nonNullable.group({
    preferredStartDate: [''],
    routeComment: [''],
    cargoType: [''],
    cargoWeightKg: [''],
    cargoVolumeM3: ['']
  });

  readonly totalDistanceMeters = computed(() => this.segmentDistances().reduce((sum, distance) => sum + distance, 0));
  readonly hasRoute = computed(() => this.waypoints().length >= 2);
  readonly hasPendingBorder = computed(() => hasPendingBorderCheckpoint(this.waypoints()));
  readonly lang = computed<FreightLang>(() => {
    const current = this.translate.currentLang || this.translate.getDefaultLang() || 'uk';
    return (['uk', 'ru', 'en'].includes(current) ? current : 'uk') as FreightLang;
  });

  private map: L.Map | null = null;
  private markers: L.Marker[] = [];
  private routeLayer: L.Polyline | null = null;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private resizeTimers: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    effect(() => {
      const points = this.waypoints();
      const selectedIndex = this.selectedWaypointIndex();
      this.rebuildMarkers(points, selectedIndex);
    });
  }

  ngAfterViewInit(): void {
    this.initializeMapWhenContainerReady();
    void this.loadRouteFromQuery();
  }

  ngOnDestroy(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.resizeTimers.forEach((timer) => clearTimeout(timer));
    this.map?.remove();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.scheduleMapResizeFix();
  }

  async onMapClick(event: L.LeafletMouseEvent): Promise<void> {
    await this.addWaypoint(event.latlng.lat, event.latlng.lng);
  }

  selectWaypoint(index: number): void {
    const point = this.waypoints()[index];
    if (!point || !this.map) {
      return;
    }
    this.selectedWaypointIndex.set(index);
    this.map.flyTo([point.lat, point.lng], Math.max(this.map.getZoom(), 8), {
      animate: true,
      duration: 0.35
    });
  }

  async onSearchChange(value: string): Promise<void> {
    const query = value.trim();
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    if (query.length < 3) {
      this.searchResults.set([]);
      this.highlightedSearchIndex.set(-1);
      return;
    }
    this.isSearching.set(true);
    this.searchDebounceTimer = setTimeout(async () => {
      const items = await this.searchAddress(query);
      this.searchResults.set(items);
      this.highlightedSearchIndex.set(items.length > 0 ? 0 : -1);
      this.isSearching.set(false);
    }, 500);
  }

  async selectSearchResult(item: NominatimResult, input: HTMLInputElement): Promise<void> {
    input.value = '';
    this.searchResults.set([]);
    this.highlightedSearchIndex.set(-1);
    await this.addWaypoint(Number(item.lat), Number(item.lon), item.display_name, item.address?.country_code ?? null);
  }

  async removeWaypoint(index: number): Promise<void> {
    this.waypoints.update((items) => items.filter((_, currentIndex) => currentIndex !== index));
    this.selectedWaypointIndex.update((current) => {
      if (current === null) {
        return null;
      }
      if (current === index) {
        return null;
      }
      return current > index ? current - 1 : current;
    });
    await this.recalculateRoute();
  }

  async clearAllPoints(): Promise<void> {
    this.waypoints.set([]);
    this.segmentDistances.set([]);
    this.searchResults.set([]);
    this.selectedWaypointIndex.set(null);
    this.requestOpen.set(false);
    this.selectedCountryBySegment.set({});
    this.borderCheckpointSelectValue.set({});
    this.dropdownSegmentIndex.set(null);
    if (this.routeLayer && this.map) {
      this.map.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }
  }

  async saveCurrentRoute(): Promise<void> {
    if (!this.hasRoute()) {
      this.showToast('pages.freightCalculation.errors.routeRequired');
      return;
    }
    this.isSavingRoute.set(true);
    try {
      const snapshot = await firstValueFrom(
        this.http.post<RouteSnapshotContractDto>(this.backendApi.routes, this.createRouteSnapshotRequest())
      );
      this.showToast('pages.freightCalculation.routeSaved');
      await this.loadMyRoutes();
      await this.router.navigate([], {
        relativeTo: this.activatedRoute,
        queryParams: { routeId: snapshot.id },
        queryParamsHandling: 'merge'
      });
    } catch {
      this.showToast('pages.freightCalculation.errors.routeSaveFailed');
    } finally {
      this.isSavingRoute.set(false);
    }
  }

  async goToRoutesHistory(): Promise<void> {
    await this.loadMyRoutes();
    await this.router.navigate(['/routes-history']);
  }

  /** Відкриття/закриття панелі вибору КПП для сегмента маршруту */
  onBorderExpansionChange(segmentIndex: number, expanded: boolean): void {
    if (expanded) {
      this.dropdownSegmentIndex.set(segmentIndex);
      return;
    }
    if (this.dropdownSegmentIndex() === segmentIndex) {
      this.dropdownSegmentIndex.set(null);
    }
  }

  /** Вибір країни транзиту в mat-select */
  onBorderCountryMatSelect(segmentIndex: number, value: unknown): void {
    const country = typeof value === 'string' && value.length > 0 ? value : null;
    this.selectedCountryBySegment.update((prev) => ({ ...prev, [segmentIndex]: country }));
    this.borderCheckpointSelectValue.update((m) => ({ ...m, [segmentIndex]: '' }));
  }

  getBorderCheckpointSelectValue(segmentIndex: number): string {
    return this.borderCheckpointSelectValue()[segmentIndex] ?? '';
  }

  /** Вибір КПП у другому mat-select — одразу додає точку на маршрут */
  async onBorderCheckpointMatSelect(segmentIndex: number, value: unknown): Promise<void> {
    const str = value === null || value === undefined ? '' : String(value);
    if (str === '') {
      return;
    }
    const idx = Number(str);
    if (!Number.isInteger(idx) || idx < 0) {
      return;
    }
    await this.addBorderCheckpoint(segmentIndex, idx);
    this.borderCheckpointSelectValue.update((m) => ({ ...m, [segmentIndex]: '' }));
  }

  async addBorderCheckpoint(segmentIndex: number, checkpointIndex: number): Promise<void> {
    const country = this.selectedCountryBySegment()[segmentIndex];
    if (!country) {
      return;
    }
    const checkpoint = CHECKPOINTS_DATA[country]?.[checkpointIndex];
    if (!checkpoint) {
      return;
    }
    const name = checkpoint.name[this.lang()] ?? checkpoint.name.en;
    const next = [...this.waypoints()];
    next.splice(segmentIndex + 1, 0, {
      lat: checkpoint.lat,
      lng: checkpoint.lng,
      address: name,
      country,
      isBorder: true
    });
    this.waypoints.set(next);
    this.selectedWaypointIndex.set(segmentIndex + 1);
    this.dropdownSegmentIndex.set(null);
    await this.recalculateRoute();
  }

  openRequestPage(): void {
    if (!this.hasRoute()) {
      this.showToast('pages.freightCalculation.errors.routeRequired');
      return;
    }
    if (this.hasPendingBorder()) {
      this.showToast('pages.freightCalculation.errors.selectBorderRequired');
      return;
    }
    if (!this.getSelectedRouteId()) {
      this.showToast('pages.freightCalculation.errors.routeMustBeSaved');
      return;
    }
    this.requestOpen.set(true);
  }

  closeRequestPage(): void {
    this.requestOpen.set(false);
  }

  async submitRequest(): Promise<void> {
    const routeId = this.getSelectedRouteId();
    if (!routeId) {
      this.showToast('pages.freightCalculation.errors.routeMustBeSaved');
      return;
    }
    this.isSubmitting.set(true);
    try {
      await this.routeRequestsApi.createRouteRequest(this.createRouteRequestPayload(routeId));
      this.requestForm.reset({
        preferredStartDate: '',
        routeComment: '',
        cargoType: '',
        cargoWeightKg: '',
        cargoVolumeM3: ''
      });
      this.requestOpen.set(false);
      this.showToast('pages.freightCalculation.success');
    } catch {
      this.showToast('pages.freightCalculation.errors.submitFailed');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  getSegmentCountryOptions(): string[] {
    return Object.keys(CHECKPOINTS_DATA);
  }

  getCheckpoints(country: string): Checkpoint[] {
    return CHECKPOINTS_DATA[country] ?? [];
  }

  getCheckpointLocalizedName(checkpoint: Checkpoint): string {
    return checkpoint.name[this.lang()] ?? checkpoint.name.en;
  }

  getPointLabel(index: number): string {
    const points = this.waypoints();
    if (index === 0) {
      return 'pages.freightCalculation.labels.start';
    }
    if (index === points.length - 1) {
      return 'pages.freightCalculation.labels.finish';
    }
    return points[index].isBorder
      ? 'pages.freightCalculation.labels.border'
      : 'pages.freightCalculation.labels.stop';
  }

  async onSearchKeydown(event: KeyboardEvent, input: HTMLInputElement): Promise<void> {
    const items = this.searchResults();
    if (!items.length) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.highlightedSearchIndex.update((current) => (current + 1) % items.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlightedSearchIndex.update((current) => (current - 1 + items.length) % items.length);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const selectedIndex = this.highlightedSearchIndex();
      const selected = items[selectedIndex] ?? items[0];
      await this.selectSearchResult(selected, input);
      return;
    }
    if (event.key === 'Escape') {
      this.searchResults.set([]);
      this.highlightedSearchIndex.set(-1);
    }
  }

  private initializeMap(): void {
    const container = this.mapContainer.nativeElement;
    // Висота задається в SCSS (.map); інлайн height:100% ламає Leaflet при height:auto у батька
    container.style.width = '100%';
    container.style.removeProperty('height');
    container.style.removeProperty('min-height');

    const map = L.map(this.mapContainer.nativeElement, { zoomControl: true }).setView([50.4501, 30.5234], 6);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; GeoSan'
    }).addTo(map);
    map.on('click', (event: L.LeafletMouseEvent) => void this.onMapClick(event));
    this.map = map;
    this.rebuildMarkers();
    this.scheduleMapResizeFix();
    requestAnimationFrame(() => {
      this.map?.invalidateSize();
    });
  }

  private initializeMapWhenContainerReady(attempt = 0): void {
    const container = this.mapContainer.nativeElement;
    const hasSize = container.clientWidth > 0 && container.clientHeight > 0;
    if (hasSize) {
      this.initializeMap();
      return;
    }
    if (attempt >= 30) {
      this.initializeMap();
      return;
    }
    const timer = setTimeout(() => {
      this.initializeMapWhenContainerReady(attempt + 1);
    }, 50);
    this.resizeTimers.push(timer);
  }

  private scheduleMapResizeFix(): void {
    this.resizeTimers.forEach((timer) => clearTimeout(timer));
    const delays = [0, 100, 300, 700];
    this.resizeTimers = delays.map((delay) =>
      setTimeout(() => {
        this.map?.invalidateSize();
      }, delay)
    );
  }

  private async addWaypoint(lat: number, lng: number, address?: string, country?: string | null): Promise<void> {
    const fallbackAddress = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const waypointIndex = this.waypoints().length;
    const hasProvidedAddress = Boolean(address);

    this.waypoints.update((items) => {
      const next = [
        ...items,
        {
          lat,
          lng,
          address: address ?? fallbackAddress,
          country: country?.toLowerCase() ?? null,
          isBorder: false
        }
      ];
      this.selectedWaypointIndex.set(next.length - 1);
      return next;
    });

    await this.recalculateRoute();

    if (hasProvidedAddress) {
      return;
    }

    const geocoded = await this.reverseGeocode(lat, lng);
    this.waypoints.update((items) =>
      items.map((item, index) =>
        index === waypointIndex
          ? { ...item, address: geocoded.address, country: geocoded.country }
          : item
      )
    );
  }

  private async recalculateRoute(): Promise<void> {
    const points = this.waypoints();
    if (points.length < 2) {
      this.segmentDistances.set([]);
      if (this.routeLayer && this.map) {
        this.map.removeLayer(this.routeLayer);
        this.routeLayer = null;
      }
      return;
    }
    const route = await this.fetchRoute(points);
    if (!route || !this.map) {
      this.segmentDistances.set([]);
      return;
    }
    this.segmentDistances.set(route.legs.map((leg) => leg.distance));
    if (this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
    }
    const latLngs = route.geometry.coordinates.map(([lng, lat]) => L.latLng(lat, lng));
    this.routeLayer = L.polyline(latLngs, { color: '#2563eb', weight: 5, opacity: 0.7 }).addTo(this.map);
    this.map.fitBounds(this.routeLayer.getBounds(), { padding: [40, 40] });
  }

  private rebuildMarkers(points: Waypoint[] = this.waypoints(), selectedIndex: number | null = this.selectedWaypointIndex()): void {
    if (!this.map) {
      return;
    }
    this.markers.forEach((marker) => marker.remove());
    this.markers = points.map((point, index) => {
      const marker = L.marker([point.lat, point.lng], {
        draggable: true,
        icon: this.createWaypointIcon(point, index, index === selectedIndex),
        zIndexOffset: 1000
      }).addTo(this.map!);
      marker.on('click', () => {
        this.selectWaypoint(index);
      });
      marker.on('dragend', async () => {
        const position = marker.getLatLng();
        const geocoded = await this.reverseGeocode(position.lat, position.lng);
        this.selectWaypoint(index);
        this.waypoints.update((items) =>
          items.map((item, itemIndex) =>
            itemIndex === index
              ? { ...item, lat: position.lat, lng: position.lng, address: geocoded.address, country: geocoded.country }
              : item
          )
        );
        await this.recalculateRoute();
      });
      return marker;
    });
  }

  private createWaypointIcon(point: Waypoint, index: number, isSelected: boolean): L.DivIcon {
    const label = String(index + 1);
    const backgroundColor = point.isBorder ? '#16a34a' : '#2563eb';
    const borderStyle = isSelected
      ? point.isBorder
        ? 'border: 3px solid #ffffff; box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.35);'
        : 'border: 3px solid #ffffff; box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.35);'
      : 'border: none;';
    return L.divIcon({
      html: `<div style="margin:0;padding:0;border:0;background:transparent;box-shadow:none;"><div style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#ffffff;font-size:10px;font-weight:700;box-sizing:border-box;background:${backgroundColor};${borderStyle}">${label}</div></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      className: 'waypoint-icon-shell'
    });
  }

  private async searchAddress(query: string): Promise<NominatimResult[]> {
    const lang = this.lang();
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&accept-language=${lang}&addressdetails=1`);
    if (!response.ok) {
      return [];
    }
    return (await response.json()) as NominatimResult[];
  }

  private async reverseGeocode(lat: number, lng: number): Promise<{ address: string; country: string | null }> {
    const lang = this.lang();
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=${lang}&addressdetails=1`);
    if (!response.ok) {
      return { address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, country: null };
    }
    const data = (await response.json()) as NominatimResult;
    return { address: data.display_name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`, country: data.address?.country_code?.toLowerCase() ?? null };
  }

  private async fetchRoute(points: Waypoint[]): Promise<OsrmRoute | null> {
    const coords = points.map((point) => `${point.lng},${point.lat}`).join(';');
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`);
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as OsrmResponse;
    return payload.routes[0] ?? null;
  }

  private createRouteRequestPayload(routeId: string): CreateRouteRequestContractRequest {
    const values = this.requestForm.getRawValue();
    const cargoType = values.cargoType.trim();
    const cargoWeightKg = parseOptionalFormNumber(values.cargoWeightKg);
    const cargoVolumeM3 = parseOptionalFormNumber(values.cargoVolumeM3);
    const hasCargo = Boolean(cargoType) || cargoWeightKg !== null || cargoVolumeM3 !== null;

    return {
      routeId,
      preferredStartDate: values.preferredStartDate || null,
      comment: values.routeComment.trim() || null,
      cargo: hasCargo
        ? {
            type: cargoType || null,
            weightKg: cargoWeightKg,
            volumeM3: cargoVolumeM3
          }
        : null
    };
  }

  private getSelectedRouteId(): string | null {
    return this.activatedRoute.snapshot.queryParamMap.get('routeId');
  }

  private createRouteSnapshotRequest() {
    const points = this.createRoutePointsContract();
    const title = points.length >= 2 ? `${points[0].address} -> ${points[points.length - 1].address}` : 'Saved route';
    return {
      title,
      routingProfile: 'driving',
      routingMode: 'fast',
      routePolyline: this.serializeRoutePolyline(),
      distanceKm: Number((this.totalDistanceMeters() / 1000).toFixed(3)),
      durationMin: null,
      routeComment: this.requestForm.getRawValue().routeComment || null,
      points,
      hereRouteMeta: null
    };
  }

  private createRoutePointsContract(): RoutePointContract[] {
    const points = this.waypoints();
    const distances = this.segmentDistances();
    const lastIndex = points.length - 1;
    return points.map((point, index) => ({
      order: index + 1,
      type: index === 0 ? 'START' : index === lastIndex ? 'FINISH' : point.isBorder ? 'BORDER' : 'STOP',
      address: point.address,
      lat: Number(point.lat.toFixed(6)),
      lng: Number(point.lng.toFixed(6)),
      country: point.country ?? '',
      isBorder: point.isBorder,
      segmentDistanceKmToNext: index < lastIndex && distances[index] !== undefined ? Number((distances[index] / 1000).toFixed(3)) : null,
      operations: []
    }));
  }

  private serializeRoutePolyline(): string {
    if (!this.routeLayer) {
      return this.waypoints()
        .map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`)
        .join(';');
    }
    const coords = this.routeLayer.getLatLngs() as L.LatLng[];
    return JSON.stringify(coords.map((c) => [Number(c.lat.toFixed(6)), Number(c.lng.toFixed(6))]));
  }

  private async loadRouteFromQuery(): Promise<void> {
    const routeId = this.activatedRoute.snapshot.queryParamMap.get('routeId');
    if (!routeId) {
      return;
    }
    this.isLoadingSavedRoute.set(true);
    try {
      const snapshot = await firstValueFrom(
        this.http.get<RouteSnapshotContractDto>(`${this.backendApi.myRoutes}/${encodeURIComponent(routeId)}`)
      );
      await this.applySavedRoute(snapshot);
      this.showToast('pages.freightCalculation.routeLoaded');
    } catch {
      this.showToast('pages.freightCalculation.errors.routeLoadFailed');
    } finally {
      this.isLoadingSavedRoute.set(false);
    }
  }

  private async applySavedRoute(snapshot: RouteSnapshotContractDto): Promise<void> {
    const points: Waypoint[] = [...snapshot.points]
      .sort((a, b) => a.order - b.order)
      .map((point) => ({
        lat: point.lat,
        lng: point.lng,
        address: point.address,
        country: point.country ? point.country.toLowerCase() : null,
        isBorder: point.isBorder
      }));
    this.waypoints.set(points);
    this.segmentDistances.set(
      snapshot.points
        .sort((a, b) => a.order - b.order)
        .map((point) => point.segmentDistanceKmToNext)
        .filter((distance): distance is number => distance !== null)
        .map((distance) => distance * 1000)
    );
    this.selectedWaypointIndex.set(points.length ? 0 : null);
    this.requestForm.patchValue({ routeComment: snapshot.routeComment ?? '' });
    await this.drawSavedPolyline(snapshot.routePolyline, points);
  }

  private async drawSavedPolyline(routePolyline: string, points: Waypoint[]): Promise<void> {
    if (!this.map) {
      return;
    }
    if (this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }
    const latLngs = this.parseSavedPolyline(routePolyline);
    const fallback = points.map((point) => L.latLng(point.lat, point.lng));
    const path = latLngs.length ? latLngs : fallback;
    if (!path.length) {
      return;
    }
    this.routeLayer = L.polyline(path, { color: '#2563eb', weight: 5, opacity: 0.7 }).addTo(this.map);
    this.map.fitBounds(this.routeLayer.getBounds(), { padding: [40, 40] });
  }

  private parseSavedPolyline(routePolyline: string): L.LatLng[] {
    try {
      const parsed = JSON.parse(routePolyline) as Array<[number, number]>;
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .filter((item) => Array.isArray(item) && item.length === 2)
        .map((item) => L.latLng(item[0], item[1]));
    } catch {
      return [];
    }
  }

  private async loadMyRoutes(): Promise<void> {
    try {
      const routes = await firstValueFrom(this.http.get<RouteSummaryContractDto[]>(this.backendApi.myRoutes));
      this.myRoutes.set(routes);
    } catch {
      this.myRoutes.set([]);
    }
  }

  private showToast(key: string): void {
    this.toastMessage.set(key);
    setTimeout(() => this.toastMessage.set(''), 3000);
  }
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    country_code?: string;
  };
}

interface OsrmResponse {
  routes: OsrmRoute[];
}

interface OsrmRoute {
  legs: Array<{ distance: number }>;
  geometry: { coordinates: [number, number][] };
}
