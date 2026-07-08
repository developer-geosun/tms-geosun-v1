package com.geosun.tms.freight.cost.service;

import com.geosun.tms.freight.cost.domain.DriverSalaryBasis;
import com.geosun.tms.freight.cost.dto.response.FreightCostCalculationSummaryDto;
import com.geosun.tms.freight.cost.dto.response.TollCountryLineDto;
import java.math.RoundingMode;
import org.springframework.stereotype.Component;

@Component
public class FreightCostCalculationSummaryBuilder {

  /** Формує україномовний текстовий звіт згідно ТЗ §7.1. */
  public String build(FreightCostCalculationSummaryDto data) {
    StringBuilder sb = new StringBuilder();
    sb.append("=== Розрахунок собівартості рейсу ===\n");
    sb.append("Дата розрахунку: ").append(data.calculationDate()).append('\n');
    sb.append("Сценарій: ").append(data.scenarioName()).append('\n');
    sb.append("Валюта пропозиції: ").append(data.proposalCurrency()).append("\n\n");

    sb.append("--- Вхідні дані ---\n");
    sb.append("L_total: ").append(km(data.lTotalKm())).append(" км\n");
    sb.append("L_empty: ").append(km(data.lEmptyKm())).append(" км\n");
    sb.append("L_loaded: ").append(km(data.lLoadedKm())).append(" км\n");
    sb.append("Доїзд до першої точки: ").append(km(data.preRouteEmptyKm())).append(" км\n");
    sb.append("Сезон: ").append(data.seasonUsed()).append('\n');
    if (data.lengthFallbackUsed()) {
      sb.append("Примітка: застосовано fallback 15% порожній / 85% завантажений.\n");
    }
    sb.append('\n');

    sb.append("--- Курси НБУ (дата знімка ").append(data.nbuRateDate()).append(") ---\n");
    sb.append("EUR/UAH: ").append(money(data.eurRatePerUnit())).append('\n');
    sb.append("USD/UAH: ").append(money(data.usdRatePerUnit())).append('\n');
    sb.append("Кросс-курс до ")
        .append(data.proposalCurrency())
        .append(": UAH ÷ ")
        .append(money(data.proposalRatePerUnit()))
        .append(" = ")
        .append(data.proposalCurrency())
        .append('\n');
    sb.append('\n');

    sb.append("--- Паливо ---\n");
    sb.append("Порожній: ").append(liters(data.fuelLitersEmpty())).append(" л\n");
    sb.append("Завантажений: ").append(liters(data.fuelLitersLoaded())).append(" л\n");
    sb.append("Разом паливо: ").append(money(data.fuelCostUah())).append(" UAH\n\n");

    sb.append("--- Добові ---\n");
    sb.append("Днів: ").append(data.perDiemDays()).append('\n');
    sb.append("Сума: ").append(money(data.perDiemEur())).append(" EUR = ");
    sb.append(money(data.perDiemUah())).append(" UAH\n\n");

    sb.append("--- Дороги ---\n");
    for (TollCountryLineDto line : data.tollLines()) {
      sb.append(line.countryCode()).append(": ");
      sb.append(km(line.distanceKm())).append(" км, ");
      if (line.tollType() != null) {
        sb.append(line.tollType()).append(" ");
        sb.append(money(line.rate()));
        if (line.fixedDays() != null) {
          sb.append(" × ").append(line.fixedDays()).append(" дн.");
        }
      } else if (line.defaultEuFallback()) {
        sb.append("EU fallback 0.10 EUR/км");
      } else {
        sb.append("без тарифу");
      }
      sb.append(" → ").append(money(line.amountEur())).append(" EUR = ");
      sb.append(money(line.amountUah())).append(" UAH\n");
    }
    sb.append("Разом дороги: ").append(money(data.tollsUah())).append(" UAH\n\n");

    sb.append("--- Прямі витрати ---\n");
    sb.append("DirectCost: ").append(money(data.directCostUah())).append(" UAH\n\n");

    sb.append("--- ЗП та маржа ---\n");
    sb.append("База ЗП: ").append(DriverSalaryBasis.PERCENT_OF_FINAL_FREIGHT).append('\n');
    sb.append("ЗП: ").append(percent(data.driverSalaryPercent())).append("% → ");
    sb.append(money(data.driverCostUah())).append(" UAH\n");
    sb.append("S (до маржі): ").append(money(data.costBeforeMarginUah())).append(" UAH\n");
    sb.append("Маржа: ").append(percent(data.marginPercent())).append("% → ");
    sb.append(money(data.marginUah())).append(" UAH\n");
    sb.append("T (разом UAH): ").append(money(data.totalUah())).append(" UAH\n\n");

    sb.append("--- Пропозиція клієнту ---\n");
    sb.append(money(data.totalProposalAmount()))
        .append(' ')
        .append(data.proposalCurrency())
        .append('\n');
    return sb.toString();
  }

  private static String km(java.math.BigDecimal value) {
    return value.setScale(3, RoundingMode.HALF_UP).toPlainString();
  }

  private static String liters(java.math.BigDecimal value) {
    return value.setScale(3, RoundingMode.HALF_UP).toPlainString();
  }

  private static String money(java.math.BigDecimal value) {
    return value.setScale(2, RoundingMode.HALF_UP).toPlainString();
  }

  private static String percent(java.math.BigDecimal value) {
    return value.setScale(2, RoundingMode.HALF_UP).toPlainString();
  }
}
