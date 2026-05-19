package com.geosun.tms.freight.domain;

import com.geosun.tms.auth.domain.user.User;
import com.geosun.tms.routes.domain.RouteRequest;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "freight_ai_calculations")
public class FreightAiCalculation {
  @Id
  @Column(name = "id", nullable = false, updatable = false, length = 36)
  private String id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "route_request_id", nullable = false)
  private RouteRequest routeRequest;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "scenario_id")
  private FreightCalculationScenario scenario;

  @Column(name = "scenario_rules_snapshot", columnDefinition = "text")
  private String scenarioRulesSnapshot;

  @Column(name = "model_id", length = 128)
  private String modelId;

  @Column(name = "prompt_payload", columnDefinition = "json")
  private String promptPayload;

  @Column(name = "response_text", columnDefinition = "longtext")
  private String responseText;

  @Column(name = "response_structured", columnDefinition = "json")
  private String responseStructured;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false, length = 32)
  private AiCalculationStatus status;

  @Column(name = "error_message", columnDefinition = "text")
  private String errorMessage;

  @Column(name = "latency_ms")
  private Integer latencyMs;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "created_by_user_id", nullable = false)
  private User createdBy;

  @PrePersist
  void assignId() {
    if (id == null) {
      id = UUID.randomUUID().toString();
    }
  }

  public String getId() {
    return id;
  }

  public RouteRequest getRouteRequest() {
    return routeRequest;
  }

  public void setRouteRequest(RouteRequest routeRequest) {
    this.routeRequest = routeRequest;
  }

  public FreightCalculationScenario getScenario() {
    return scenario;
  }

  public void setScenario(FreightCalculationScenario scenario) {
    this.scenario = scenario;
  }

  public String getScenarioRulesSnapshot() {
    return scenarioRulesSnapshot;
  }

  public void setScenarioRulesSnapshot(String scenarioRulesSnapshot) {
    this.scenarioRulesSnapshot = scenarioRulesSnapshot;
  }

  public String getModelId() {
    return modelId;
  }

  public void setModelId(String modelId) {
    this.modelId = modelId;
  }

  public String getPromptPayload() {
    return promptPayload;
  }

  public void setPromptPayload(String promptPayload) {
    this.promptPayload = promptPayload;
  }

  public String getResponseText() {
    return responseText;
  }

  public void setResponseText(String responseText) {
    this.responseText = responseText;
  }

  public String getResponseStructured() {
    return responseStructured;
  }

  public void setResponseStructured(String responseStructured) {
    this.responseStructured = responseStructured;
  }

  public AiCalculationStatus getStatus() {
    return status;
  }

  public void setStatus(AiCalculationStatus status) {
    this.status = status;
  }

  public String getErrorMessage() {
    return errorMessage;
  }

  public void setErrorMessage(String errorMessage) {
    this.errorMessage = errorMessage;
  }

  public Integer getLatencyMs() {
    return latencyMs;
  }

  public void setLatencyMs(Integer latencyMs) {
    this.latencyMs = latencyMs;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public User getCreatedBy() {
    return createdBy;
  }

  public void setCreatedBy(User createdBy) {
    this.createdBy = createdBy;
  }
}
