package com.geosun.tms.routes.service;

import com.geosun.tms.auth.exception.ApiException;
import com.geosun.tms.routes.domain.Route;
import com.geosun.tms.routes.domain.RoutePoint;
import com.geosun.tms.routes.domain.RouteRequest;
import com.geosun.tms.routes.domain.RouteRequestStatusHistory;
import com.geosun.tms.routes.dto.RoutePointType;
import com.geosun.tms.routes.dto.RouteRequestStatus;
import com.geosun.tms.routes.dto.request.CargoDetailsRequest;
import com.geosun.tms.routes.dto.request.CreateRouteRequestRequest;
import com.geosun.tms.routes.dto.response.CountryDistanceDto;
import com.geosun.tms.routes.dto.response.QuoteDto;
import com.geosun.tms.routes.dto.response.RoutePointDto;
import com.geosun.tms.routes.dto.response.RouteRequestDto;
import com.geosun.tms.routes.dto.response.RouteSnapshotDto;
import com.geosun.tms.routes.repository.RouteRepository;
import com.geosun.tms.routes.repository.RouteRequestRepository;
import com.geosun.tms.routes.repository.RouteRequestStatusHistoryRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RouteRequestService {
  private final RouteRepository routeRepository;
  private final RouteRequestRepository routeRequestRepository;
  private final RouteRequestStatusHistoryRepository historyRepository;
  private final CountryBreakdownService countryBreakdownService;
  private final FreightQuoteService freightQuoteService;

  public RouteRequestService(
      RouteRepository routeRepository,
      RouteRequestRepository routeRequestRepository,
      RouteRequestStatusHistoryRepository historyRepository,
      CountryBreakdownService countryBreakdownService,
      FreightQuoteService freightQuoteService) {
    this.routeRepository = routeRepository;
    this.routeRequestRepository = routeRequestRepository;
    this.historyRepository = historyRepository;
    this.countryBreakdownService = countryBreakdownService;
    this.freightQuoteService = freightQuoteService;
  }

  @Transactional
  public RouteRequestDto createRouteRequest(String userId, CreateRouteRequestRequest request) {
    Long routeId = parseRouteId(request.routeId());
    Route route =
        routeRepository
            .findByIdAndUserIdAndDeletedFalse(routeId, userId)
            .orElseThrow(() -> ApiException.notFound("Route not found"));

    RouteRequest routeRequest = new RouteRequest();
    routeRequest.setUser(route.getUser());
    routeRequest.setRoute(route);
    routeRequest.setStatus(RouteRequestStatus.NEW);
    routeRequest.setComment(request.comment());
    routeRequest.setPreferredStartDate(parseDateOrNull(request.preferredStartDate()));
    applyCargo(routeRequest, request.cargo());
    RouteRequest saved = routeRequestRepository.save(routeRequest);

    RouteRequestStatusHistory history = new RouteRequestStatusHistory();
    history.setRequest(saved);
    history.setFromStatus(null);
    history.setToStatus(RouteRequestStatus.NEW);
    history.setChangedBy(route.getUser());
    history.setNote("Created by user");
    historyRepository.save(history);

    return toDto(saved, true);
  }

  @Transactional(readOnly = true)
  public List<RouteRequestDto> getMyRouteRequests(String userId) {
    return routeRequestRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
        .map((request) -> toDto(request, false))
        .toList();
  }

  @Transactional(readOnly = true)
  public RouteRequestDto getMyRouteRequestById(String userId, Long requestId) {
    RouteRequest request =
        routeRequestRepository
            .findByIdAndUserId(requestId, userId)
            .orElseThrow(() -> ApiException.notFound("Route request not found"));
    return toDto(request, true);
  }

  @Transactional(readOnly = true)
  public List<RouteRequestDto> getAllRequestsForAdmin() {
    return routeRequestRepository.findAllByOrderByCreatedAtDesc().stream()
        .map((request) -> toDto(request, false))
        .toList();
  }

  @Transactional(readOnly = true)
  public RouteRequestDto getRequestByIdForAdmin(Long requestId) {
    Long nonNullRequestId = Objects.requireNonNull(requestId, "requestId must not be null");
    RouteRequest request =
        routeRequestRepository
            .findById(nonNullRequestId)
            .orElseThrow(() -> ApiException.notFound("Route request not found"));
    return toDto(request, true);
  }

  /** Явний перерахунок пробігу по країнах (HERE) для адмінки; ТЗ §3.3. */
  @Transactional
  public RouteRequestDto recalculateCountryBreakdownForAdmin(Long requestId) {
    RouteRequest request =
        routeRequestRepository
            .findById(requestId)
            .orElseThrow(() -> ApiException.notFound("Route request not found"));
    countryBreakdownService.getOrCalculate(request.getRoute());
    return toDto(request, true);
  }

  private RouteRequestDto toDto(RouteRequest request, boolean includeRoutePoints) {
    Long requestId = Objects.requireNonNull(request.getId(), "Route request id must not be null");
    RouteSnapshotDto route =
        includeRoutePoints
            ? toRouteSnapshot(request.getRoute())
            : toRouteSummaryAsSnapshot(request.getRoute());
    List<CountryDistanceDto> countryDistances =
        countryBreakdownService.listStoredOnly(request.getRoute());
    QuoteDto currentQuote = freightQuoteService.getCurrentQuoteForRequest(requestId);
    return new RouteRequestDto(
        request.getId(),
        String.valueOf(request.getRoute().getId()),
        request.getStatus(),
        request.getPreferredStartDate() == null ? null : request.getPreferredStartDate().toString(),
        request.getComment(),
        request.getCreatedAt() == null ? null : request.getCreatedAt().toString(),
        request.getUpdatedAt() == null ? null : request.getUpdatedAt().toString(),
        route,
        countryDistances,
        currentQuote);
  }

  private RouteSnapshotDto toRouteSummaryAsSnapshot(Route route) {
    boolean locked = routeRequestRepository.existsByRoute_Id(route.getId());
    return new RouteSnapshotDto(
        String.valueOf(route.getId()),
        route.getTitle(),
        route.getRoutingProfile(),
        route.getRoutingMode(),
        route.getRoutePolyline(),
        toDouble(route.getDistanceKm()),
        route.getDurationMin(),
        route.getRouteComment(),
        route.getCreatedAt() == null ? null : route.getCreatedAt().toString(),
        route.getUpdatedAt() == null ? null : route.getUpdatedAt().toString(),
        List.of(),
        locked);
  }

  private RouteSnapshotDto toRouteSnapshot(Route route) {
    boolean locked = routeRequestRepository.existsByRoute_Id(route.getId());
    List<RoutePointDto> points =
        route.getPoints() == null
            ? List.of()
            : route.getPoints().stream()
                .sorted(Comparator.comparing(RoutePoint::getPointOrder))
                .map(
                    point ->
                        new RoutePointDto(
                            point.getPointOrder(),
                            RoutePointType.valueOf(point.getPointType().name()),
                            point.getAddress(),
                            toDouble(point.getLat()),
                            toDouble(point.getLng()),
                            point.getCountry(),
                            point.isBorder(),
                            toDouble(point.getSegmentDistanceKmToNext()),
                            RouteService.toDtoOperations(point.getOperations())))
                .toList();

    return new RouteSnapshotDto(
        String.valueOf(route.getId()),
        route.getTitle(),
        route.getRoutingProfile(),
        route.getRoutingMode(),
        route.getRoutePolyline(),
        toDouble(route.getDistanceKm()),
        route.getDurationMin(),
        route.getRouteComment(),
        route.getCreatedAt() == null ? null : route.getCreatedAt().toString(),
        route.getUpdatedAt() == null ? null : route.getUpdatedAt().toString(),
        points,
        locked);
  }

  private LocalDate parseDateOrNull(String rawDate) {
    if (rawDate == null || rawDate.isBlank()) {
      return null;
    }
    try {
      return LocalDate.parse(rawDate);
    } catch (DateTimeParseException ex) {
      throw ApiException.badRequest("VALIDATION_ERROR", "Invalid preferredStartDate format");
    }
  }

  private Long parseRouteId(String routeId) {
    try {
      return Long.parseLong(Objects.requireNonNull(routeId, "routeId must not be null"));
    } catch (NumberFormatException ex) {
      throw ApiException.badRequest("VALIDATION_ERROR", "Route id must be numeric");
    }
  }

  private static void applyCargo(RouteRequest routeRequest, CargoDetailsRequest cargo) {
    if (cargo == null) {
      return;
    }
    routeRequest.setCargoType(cargo.type());
    routeRequest.setWeightKg(toBigDecimal(cargo.weightKg()));
    routeRequest.setVolumeM3(toBigDecimal(cargo.volumeM3()));
  }

  private static BigDecimal toBigDecimal(Double value) {
    return value == null ? null : BigDecimal.valueOf(value);
  }

  private static Double toDouble(BigDecimal value) {
    return value == null ? null : value.doubleValue();
  }
}
