package com.geosun.tms.freight.domain;

import com.geosun.tms.auth.domain.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "freight_calculation_scenarios")
public class FreightCalculationScenario {
  @Id
  @Column(name = "id", nullable = false, updatable = false, length = 36)
  private String id;

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "description", columnDefinition = "text")
  private String description;

  @Column(name = "rules_text", nullable = false, columnDefinition = "text")
  private String rulesText;

  @Column(name = "output_format_hint", length = 64)
  private String outputFormatHint;

  @Column(name = "is_active", nullable = false)
  private boolean active = true;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "created_by_user_id", nullable = false)
  private User createdBy;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "updated_by_user_id", nullable = false)
  private User updatedBy;

  @PrePersist
  void assignId() {
    if (id == null) {
      id = UUID.randomUUID().toString();
    }
  }

  public String getId() {
    return id;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }

  public String getRulesText() {
    return rulesText;
  }

  public void setRulesText(String rulesText) {
    this.rulesText = rulesText;
  }

  public String getOutputFormatHint() {
    return outputFormatHint;
  }

  public void setOutputFormatHint(String outputFormatHint) {
    this.outputFormatHint = outputFormatHint;
  }

  public boolean isActive() {
    return active;
  }

  public void setActive(boolean active) {
    this.active = active;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  public User getCreatedBy() {
    return createdBy;
  }

  public void setCreatedBy(User createdBy) {
    this.createdBy = createdBy;
  }

  public User getUpdatedBy() {
    return updatedBy;
  }

  public void setUpdatedBy(User updatedBy) {
    this.updatedBy = updatedBy;
  }
}
