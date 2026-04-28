package com.geosun.tms.routes.dto.response;

import com.geosun.tms.routes.dto.QuoteStatus;

/**
 * Read-модель комерційної пропозиції (quote).
 */
public record QuoteDto(
    String id,
    String requestId,
    String currency,
    Double totalAmount,
    Integer transitDaysMin,
    Integer transitDaysMax,
    String validUntil,
    QuoteStatus status,
    String publicNote,
    String createdAt,
    String sentAt) {}

