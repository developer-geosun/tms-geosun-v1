package com.geosun.tms.freight.dto.response;

public record ScenarioDto(
    String id,
    String name,
    String description,
    String rulesText,
    String outputFormatHint,
    boolean isActive,
    String createdAt,
    String updatedAt) {}
