package com.geosun.tms.routes.service;

import com.geosun.tms.auth.domain.user.User;
import com.geosun.tms.auth.exception.ApiException;
import com.geosun.tms.auth.repository.UserRepository;
import com.geosun.tms.routes.domain.Route;
import com.geosun.tms.routes.domain.RoutePoint;
import com.geosun.tms.routes.domain.RoutePointKind;
import com.geosun.tms.routes.dto.RoutePointType;
import com.geosun.tms.routes.dto.request.CreateRouteRequestRequest;
import com.geosun.tms.routes.dto.request.RoutePointRequest;
import com.geosun.tms.routes.dto.request.SaveRouteRequest;
import com.geosun.tms.routes.dto.response.RoutePointDto;
import com.geosun.tms.routes.dto.response.RouteRequestDto;
import com.geosun.tms.routes.dto.response.RouteSnapshotDto;
import com.geosun.tms.routes.dto.response.RouteSummaryDto;
import com.geosun.tms.routes.repository.RouteRepository;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
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
    User user =
        userRepository
            .findById(userId)
            .orElseThrow(() -> ApiException.notFound("User not found"));

    Route route = new Route();
    route.setUser(user);
    route.setTitle(request.title());
    route.setRoutingProfile(request.routingProfile());
    route.setRoutingMode(request.routingMode());
    route.setRoutePolyline(request.routePolyline());
    route.setDistanceKm(request.distanceKm());
    route.setDurationMin(request.durationMin());
    route.setRouteComment(request.routeComment());
    route.setPoints(
        request.points().stream()
            .sorted(Comparator.comparing(RoutePointRequest::order))
            .map((point) -> toEntityPoint(route, point))
            .toList());

    Route saved = routeRepository.save(route);
    return toSnapshot(saved);
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
  public RouteSnapshotDto getMyRouteById(String userId, String routeId) {
    Route route =
        routeRepository
            .findByIdAndUserIdWithPoints(routeId, userId)
            .orElseThrow(() -> ApiException.notFound("Route not found"));
    route.setLastOpenedAt(Instant.now());
    return toSnapshot(route);
  }

  @Transactional
  public void softDeleteMyRoute(String userId, String routeId) {
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
    point.setLat(request.lat());
    point.setLng(request.lng());
    point.setCountry(request.country());
    point.setBorder(Boolean.TRUE.equals(request.isBorder()));
    point.setSegmentDistanceKmToNext(request.segmentDistanceKmToNext());
    return point;
  }

  private RouteSummaryDto toSummary(Route route) {
    return new RouteSummaryDto(
        route.getId(),
        route.getTitle(),
        route.getDistanceKm(),
        route.getDurationMin(),
        route.getPoints() == null ? 0 : route.getPoints().size(),
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
        route.getId(),
        route.getTitle(),
        route.getRoutingProfile(),
        route.getRoutingMode(),
        route.getRoutePolyline(),
        route.getDistanceKm(),
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
        point.getLat(),
        point.getLng(),
        point.getCountry(),
        point.isBorder(),
        point.getSegmentDistanceKmToNext());
  }

  private static void validatePoints(List<RoutePointRequest> points) {
    if (points == null || points.size() < 2) {
      throw ApiException.badRequest("ROUTE_POINTS_INVALID", "Route must contain at least 2 points");
    }
  }
}

