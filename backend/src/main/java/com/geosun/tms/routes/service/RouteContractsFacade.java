package com.geosun.tms.routes.service;

import com.geosun.tms.routes.dto.request.CreateRouteRequestRequest;
import com.geosun.tms.routes.dto.request.SaveRouteRequest;
import com.geosun.tms.routes.dto.response.RouteRequestDto;
import com.geosun.tms.routes.dto.response.RouteSnapshotDto;
import com.geosun.tms.routes.dto.response.RouteSummaryDto;
import java.util.List;

/**
 * Фасад контрактів Phase 0: формалізує майбутні use-case без реалізації.
 */
public interface RouteContractsFacade {
  RouteSnapshotDto saveRoute(String userId, SaveRouteRequest request);

  List<RouteSummaryDto> getMyRoutes(String userId);

  RouteSnapshotDto getMyRouteById(String userId, String routeId);

  RouteRequestDto createRouteRequest(String userId, CreateRouteRequestRequest request);

  List<RouteRequestDto> getMyRouteRequests(String userId);
}
