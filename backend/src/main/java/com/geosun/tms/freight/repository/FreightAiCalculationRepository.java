package com.geosun.tms.freight.repository;

import com.geosun.tms.freight.domain.FreightAiCalculation;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FreightAiCalculationRepository extends JpaRepository<FreightAiCalculation, String> {

  @EntityGraph(attributePaths = {"scenario", "createdBy"})
  List<FreightAiCalculation> findByRouteRequest_IdOrderByCreatedAtDesc(Long routeRequestId);

  @EntityGraph(attributePaths = {"scenario", "routeRequest", "createdBy"})
  Optional<FreightAiCalculation> findWithDetailsById(String id);

  boolean existsByScenario_Id(String scenarioId);
}
