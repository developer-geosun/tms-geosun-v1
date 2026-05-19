package com.geosun.tms.freight.repository;

import com.geosun.tms.freight.domain.FreightCalculationScenario;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FreightCalculationScenarioRepository
    extends JpaRepository<FreightCalculationScenario, String> {

  List<FreightCalculationScenario> findByActiveTrueOrderByNameAsc();

  List<FreightCalculationScenario> findAllByOrderByNameAsc();

  Optional<FreightCalculationScenario> findByNameIgnoreCaseAndActiveTrue(String name);

  boolean existsByNameIgnoreCaseAndActiveTrueAndIdNot(String name, String id);
}
