package com.geosun.tms.routes.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateQuoteRequest(
    @NotBlank String currency,
    @NotNull @DecimalMin(value = "0.01") Double totalAmount,
    Integer transitDaysMin,
    Integer transitDaysMax,
    String validUntil,
    String publicNote,
    String internalNote) {}
