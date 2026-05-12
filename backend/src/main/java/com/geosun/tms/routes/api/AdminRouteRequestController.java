package com.geosun.tms.routes.api;

import com.geosun.tms.auth.config.OpenApiConfig;
import com.geosun.tms.routes.dto.response.RouteRequestDto;
import com.geosun.tms.routes.service.RouteRequestService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin Route Requests")
@RestController
@RequestMapping(RoutesApiPaths.ADMIN_ROUTE_REQUESTS_BASE)
@PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
public class AdminRouteRequestController {
  private final RouteRequestService routeRequestService;

  public AdminRouteRequestController(RouteRequestService routeRequestService) {
    this.routeRequestService = routeRequestService;
  }

  @Operation(summary = "List all route requests for admin/manager")
  @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
  @GetMapping
  public List<RouteRequestDto> getAllRequests() {
    return routeRequestService.getAllRequestsForAdmin();
  }

  @Operation(summary = "Get route request details for admin/manager")
  @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
  @GetMapping("/{requestId}")
  public RouteRequestDto getRequestById(@PathVariable Long requestId) {
    return routeRequestService.getRequestByIdForAdmin(requestId);
  }
}
