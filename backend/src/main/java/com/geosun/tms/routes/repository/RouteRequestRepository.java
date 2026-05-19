package com.geosun.tms.routes.repository;

import com.geosun.tms.routes.domain.RouteRequest;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.lang.NonNull;

public interface RouteRequestRepository
    extends JpaRepository<RouteRequest, Long>, JpaSpecificationExecutor<RouteRequest> {
  boolean existsByRoute_Id(Long routeId);

  @EntityGraph(attributePaths = {"route"})
  List<RouteRequest> findByUserIdOrderByCreatedAtDesc(String userId);

  @EntityGraph(attributePaths = {"route", "route.points"})
  Optional<RouteRequest> findByIdAndUserId(Long id, String userId);

  @EntityGraph(attributePaths = {"route"})
  List<RouteRequest> findAllByOrderByCreatedAtDesc();

  @EntityGraph(attributePaths = {"route", "route.points"})
  @NonNull
  Optional<RouteRequest> findById(@NonNull Long id);
}
