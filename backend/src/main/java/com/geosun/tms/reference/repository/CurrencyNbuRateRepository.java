package com.geosun.tms.reference.repository;

import com.geosun.tms.reference.domain.CurrencyNbuRate;
import com.geosun.tms.reference.domain.CurrencyNbuRateId;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface CurrencyNbuRateRepository
    extends JpaRepository<CurrencyNbuRate, CurrencyNbuRateId> {
  @Query("SELECT MAX(r.rateDate) FROM CurrencyNbuRate r")
  Optional<LocalDate> findLatestRateDate();

  List<CurrencyNbuRate> findByRateDateAndCurrencyCodeIn(
      LocalDate rateDate, Collection<String> currencyCodes);

  List<CurrencyNbuRate> findByRateDateOrderByCurrencyCodeAsc(LocalDate rateDate);
}
