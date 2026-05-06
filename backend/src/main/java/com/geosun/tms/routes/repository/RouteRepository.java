package com.geosun.tms.routes.repository;

import com.geosun.tms.routes.domain.Route;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RouteRepository extends JpaRepository<Route, Long> {
  List<Route> findByUserIdAndDeletedFalseOrderByUpdatedAtDesc(String userId);

  Optional<Route> findByIdAndUserIdAndDeletedFalse(Long id, String userId);

  @EntityGraph(attributePaths = "points")
  @Query("select r from Route r where r.id = :id and r.user.id = :userId and r.deleted = false")
  Optional<Route> findByIdAndUserIdWithPoints(@Param("id") Long id, @Param("userId") String userId);
}
