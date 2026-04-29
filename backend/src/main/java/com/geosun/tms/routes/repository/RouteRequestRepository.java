package com.geosun.tms.routes.repository;

import com.geosun.tms.routes.domain.RouteRequest;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RouteRequestRepository extends JpaRepository<RouteRequest, String> {
  @EntityGraph(attributePaths = {"route"})
  List<RouteRequest> findByUserIdOrderByCreatedAtDesc(String userId);

  @EntityGraph(attributePaths = {"route", "route.points"})
  Optional<RouteRequest> findByIdAndUserId(String id, String userId);

  @EntityGraph(attributePaths = {"route"})
  List<RouteRequest> findAllByOrderByCreatedAtDesc();

  @EntityGraph(attributePaths = {"route", "route.points"})
  Optional<RouteRequest> findById(String id);
}
