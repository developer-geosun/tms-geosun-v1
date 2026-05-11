package com.geosun.tms.routes.service;

import com.geosun.tms.auth.domain.user.User;
import com.geosun.tms.auth.exception.ApiException;
import com.geosun.tms.auth.repository.UserRepository;
import com.geosun.tms.routes.domain.Route;
import com.geosun.tms.routes.domain.RoutePoint;
import com.geosun.tms.routes.domain.RoutePointKind;
import com.geosun.tms.routes.domain.RoutePointOperation;
import com.geosun.tms.routes.domain.RoutePointOperationsRules;
import com.geosun.tms.routes.domain.RoutePointOperationsRules.RoutePointWithOperations;
import com.geosun.tms.routes.domain.RoutePointOperationsRules.ValidationError;
import com.geosun.tms.routes.dto.RoutePointOperationDto;
import com.geosun.tms.routes.dto.RoutePointType;
import com.geosun.tms.routes.dto.request.CreateRouteRequestRequest;
import com.geosun.tms.routes.dto.request.RoutePointRequest;
import com.geosun.tms.routes.dto.request.SaveRouteRequest;
import com.geosun.tms.routes.dto.response.RoutePointDto;
import com.geosun.tms.routes.dto.response.RouteRequestDto;
import com.geosun.tms.routes.dto.response.RouteSnapshotDto;
import com.geosun.tms.routes.dto.response.RouteSummaryDto;
import com.geosun.tms.routes.repository.RouteRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RouteService implements RouteContractsFacade {
  private final RouteRepository routeRepository;
  private final UserRepository userRepository;
  private final RouteRequestService routeRequestService;

  public RouteService(
      RouteRepository routeRepository,
      UserRepository userRepository,
      RouteRequestService routeRequestService) {
    this.routeRepository = routeRepository;
    this.userRepository = userRepository;
    this.routeRequestService = routeRequestService;
  }

  @Override
  @Transactional
  public RouteSnapshotDto saveRoute(String userId, SaveRouteRequest request) {
    validatePoints(request.points());
    String safeUserId = Objects.requireNonNull(userId, "userId must not be null");
    User user =
        userRepository
            .findById(safeUserId)
            .orElseThrow(() -> ApiException.notFound("User not found"));

    Route route = new Route();
    route.setUser(user);
    route.setTitle(request.title());
    route.setRoutingProfile(request.routingProfile());
    route.setRoutingMode(request.routingMode());
    route.setRoutePolyline(request.routePolyline());
    route.setDistanceKm(toBigDecimal(request.distanceKm()));
    route.setDurationMin(request.durationMin());
    route.setRouteComment(request.routeComment());
    route.setPoints(
        new ArrayList<>(
            request.points().stream()
                .sorted(Comparator.comparing(RoutePointRequest::order))
                .map((point) -> toEntityPoint(route, point))
                .toList()));

    Route saved = routeRepository.save(route);
    return toSnapshot(saved);
  }

  @Override
  @Transactional
  public RouteSnapshotDto updateMyRoute(String userId, Long routeId, SaveRouteRequest request) {
    validatePoints(request.points());
    String safeUserId = Objects.requireNonNull(userId, "userId must not be null");
    Route route =
        routeRepository
            .findByIdAndUserIdWithPoints(routeId, safeUserId)
            .orElseThrow(() -> ApiException.notFound("Route not found"));

    route.setTitle(request.title());
    route.setRoutingProfile(request.routingProfile());
    route.setRoutingMode(request.routingMode());
    route.setRoutePolyline(request.routePolyline());
    route.setDistanceKm(toBigDecimal(request.distanceKm()));
    route.setDurationMin(request.durationMin());
    route.setRouteComment(request.routeComment());

    // Замінюємо колекцію точок маршруту повністю; завдяки orphanRemoval=true
    // старі записи видаляються автоматично.
    List<RoutePoint> newPoints =
        request.points().stream()
            .sorted(Comparator.comparing(RoutePointRequest::order))
            .map((point) -> toEntityPoint(route, point))
            .toList();
    route.getPoints().clear();
    // Примусово виконуємо DELETE старих точок до INSERT нових, аби не зачепити
    // унікальний індекс (route_id, point_order).
    routeRepository.flush();
    route.getPoints().addAll(new ArrayList<>(newPoints));

    return toSnapshot(route);
  }

  @Override
  @Transactional(readOnly = true)
  public List<RouteSummaryDto> getMyRoutes(String userId) {
    return routeRepository.findByUserIdAndDeletedFalseOrderByUpdatedAtDesc(userId).stream()
        .map(this::toSummary)
        .toList();
  }

  @Override
  @Transactional
  public RouteSnapshotDto getMyRouteById(String userId, Long routeId) {
    Route route =
        routeRepository
            .findByIdAndUserIdWithPoints(routeId, userId)
            .orElseThrow(() -> ApiException.notFound("Route not found"));
    route.setLastOpenedAt(Instant.now());
    return toSnapshot(route);
  }

  @Transactional
  public void softDeleteMyRoute(String userId, Long routeId) {
    Route route =
        routeRepository
            .findByIdAndUserIdAndDeletedFalse(routeId, userId)
            .orElseThrow(() -> ApiException.notFound("Route not found"));
    route.setDeleted(true);
    route.setDeletedAt(Instant.now());
  }

  @Override
  public RouteRequestDto createRouteRequest(String userId, CreateRouteRequestRequest request) {
    return routeRequestService.createRouteRequest(userId, request);
  }

  @Override
  public List<RouteRequestDto> getMyRouteRequests(String userId) {
    return routeRequestService.getMyRouteRequests(userId);
  }

  private static RoutePoint toEntityPoint(Route route, RoutePointRequest request) {
    RoutePoint point = new RoutePoint();
    point.setRoute(route);
    point.setPointOrder(request.order());
    point.setPointType(RoutePointKind.valueOf(request.type().name()));
    point.setAddress(request.address());
    point.setLat(toBigDecimal(request.lat()));
    point.setLng(toBigDecimal(request.lng()));
    point.setCountry(request.country());
    point.setBorder(Boolean.TRUE.equals(request.isBorder()));
    point.setSegmentDistanceKmToNext(toBigDecimal(request.segmentDistanceKmToNext()));
    point.setOperations(toDomainOperations(request.operations()));
    return point;
  }

  private static List<RoutePointOperation> toDomainOperations(
      List<RoutePointOperationDto> operations) {
    if (operations == null || operations.isEmpty()) {
      return new ArrayList<>();
    }
    List<RoutePointOperation> result = new ArrayList<>(operations.size());
    for (RoutePointOperationDto op : operations) {
      if (op != null) {
        result.add(RoutePointOperation.valueOf(op.name()));
      }
    }
    return result;
  }

  static List<RoutePointOperationDto> toDtoOperations(List<RoutePointOperation> operations) {
    if (operations == null || operations.isEmpty()) {
      return List.of();
    }
    List<RoutePointOperationDto> result = new ArrayList<>(operations.size());
    for (RoutePointOperation op : operations) {
      if (op != null) {
        result.add(RoutePointOperationDto.valueOf(op.name()));
      }
    }
    return result;
  }

  private RouteSummaryDto toSummary(Route route) {
    String createdAt =
        route.getCreatedAt() != null
            ? route.getCreatedAt().toString()
            : (route.getUpdatedAt() == null ? null : route.getUpdatedAt().toString());
    return new RouteSummaryDto(
        String.valueOf(route.getId()),
        route.getTitle(),
        toDouble(route.getDistanceKm()),
        route.getDurationMin(),
        route.getPoints() == null ? 0 : route.getPoints().size(),
        createdAt,
        route.getUpdatedAt() == null ? null : route.getUpdatedAt().toString(),
        route.getLastOpenedAt() == null ? null : route.getLastOpenedAt().toString());
  }

  private RouteSnapshotDto toSnapshot(Route route) {
    List<RoutePointDto> points =
        route.getPoints() == null
            ? List.of()
            : route.getPoints().stream()
                .sorted(Comparator.comparing(RoutePoint::getPointOrder))
                .map(this::toPointDto)
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
        points);
  }

  private RoutePointDto toPointDto(RoutePoint point) {
    RoutePointType type = RoutePointType.valueOf(point.getPointType().name());
    return new RoutePointDto(
        point.getPointOrder(),
        type,
        point.getAddress(),
        toDouble(point.getLat()),
        toDouble(point.getLng()),
        point.getCountry(),
        point.isBorder(),
        toDouble(point.getSegmentDistanceKmToNext()),
        toDtoOperations(point.getOperations()));
  }

  private static void validatePoints(List<RoutePointRequest> points) {
    if (points == null || points.size() < 2) {
      throw ApiException.badRequest("ROUTE_POINTS_INVALID", "Route must contain at least 2 points");
    }
    validateOperations(points);
  }

  private static void validateOperations(List<RoutePointRequest> points) {
    List<RoutePointRequest> orderedRequests =
        points.stream().sorted(Comparator.comparing(RoutePointRequest::order)).toList();
    List<RoutePointWithOperations> ordered =
        orderedRequests.stream().map(RouteService::toValidationPoint).toList();
    ValidationError error = RoutePointOperationsRules.validateRoute(ordered);
    if (error == null) {
      return;
    }
    if (shouldIgnoreOperationSetInvalidForCargoPair(error, orderedRequests)) {
      return;
    }
    String message = buildOperationsValidationMessage(error, orderedRequests);
    throw ApiException.badRequest("ROUTE_OPERATIONS_" + error.code().name(), message);
  }

  private static boolean shouldIgnoreOperationSetInvalidForCargoPair(
      ValidationError error, List<RoutePointRequest> orderedRequests) {
    if (error.code() != RoutePointOperationsRules.ValidationErrorCode.OPERATION_SET_INVALID) {
      return false;
    }
    int index = error.pointIndex();
    if (index < 0 || index >= orderedRequests.size()) {
      return false;
    }
    RoutePointRequest point = orderedRequests.get(index);
    if (point.type() == RoutePointType.BORDER || Boolean.TRUE.equals(point.isBorder())) {
      return false;
    }
    if (point.operations() == null || point.operations().size() != 2) {
      return false;
    }
    // Дозволяємо комбінацію LOADING+UNLOADING на не-border точці навіть якщо старі правила
    // повернули OPERATION_SET_INVALID.
    Set<RoutePointOperationDto> ops = EnumSet.copyOf(point.operations());
    return ops.contains(RoutePointOperationDto.LOADING)
        && ops.contains(RoutePointOperationDto.UNLOADING);
  }

  private static String buildOperationsValidationMessage(
      ValidationError error, List<RoutePointRequest> orderedRequests) {
    if (error.pointIndex() < 0 || error.pointIndex() >= orderedRequests.size()) {
      return "Invalid route point operations";
    }
    RoutePointRequest request = orderedRequests.get(error.pointIndex());
    return "Invalid route point operations at index "
        + error.pointIndex()
        + " (type="
        + request.type()
        + ", isBorder="
        + request.isBorder()
        + ", operations="
        + request.operations()
        + ")";
  }

  private static RoutePointWithOperations toValidationPoint(RoutePointRequest request) {
    Set<RoutePointOperation> ops = EnumSet.noneOf(RoutePointOperation.class);
    if (request.operations() != null) {
      for (RoutePointOperationDto op : request.operations()) {
        if (op != null) {
          ops.add(RoutePointOperation.valueOf(op.name()));
        }
      }
    }
    return new RoutePointWithOperations(RoutePointKind.valueOf(request.type().name()), ops);
  }

  private static BigDecimal toBigDecimal(Double value) {
    return value == null ? null : BigDecimal.valueOf(value);
  }

  private static Double toDouble(BigDecimal value) {
    return value == null ? null : value.doubleValue();
  }
}
