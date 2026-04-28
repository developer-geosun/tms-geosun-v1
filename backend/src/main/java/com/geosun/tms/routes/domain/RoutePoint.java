package com.geosun.tms.routes.domain;

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
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "route_points")
public class RoutePoint {
  @Id
  @Column(name = "id", nullable = false, updatable = false, length = 36)
  private String id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "route_id", nullable = false)
  private Route route;

  @Column(name = "point_order", nullable = false)
  private Integer pointOrder;

  @Enumerated(EnumType.STRING)
  @Column(name = "point_type", nullable = false, length = 16)
  private RoutePointKind pointType;

  @Column(name = "address", nullable = false, length = 500)
  private String address;

  @Column(name = "lat", nullable = false)
  private Double lat;

  @Column(name = "lng", nullable = false)
  private Double lng;

  @Column(name = "country", length = 8)
  private String country;

  @Column(name = "is_border", nullable = false)
  private boolean border;

  @Column(name = "segment_distance_km_to_next")
  private Double segmentDistanceKmToNext;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @PrePersist
  void assignId() {
    if (id == null) {
      id = UUID.randomUUID().toString();
    }
  }

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public Route getRoute() {
    return route;
  }

  public void setRoute(Route route) {
    this.route = route;
  }

  public Integer getPointOrder() {
    return pointOrder;
  }

  public void setPointOrder(Integer pointOrder) {
    this.pointOrder = pointOrder;
  }

  public RoutePointKind getPointType() {
    return pointType;
  }

  public void setPointType(RoutePointKind pointType) {
    this.pointType = pointType;
  }

  public String getAddress() {
    return address;
  }

  public void setAddress(String address) {
    this.address = address;
  }

  public Double getLat() {
    return lat;
  }

  public void setLat(Double lat) {
    this.lat = lat;
  }

  public Double getLng() {
    return lng;
  }

  public void setLng(Double lng) {
    this.lng = lng;
  }

  public String getCountry() {
    return country;
  }

  public void setCountry(String country) {
    this.country = country;
  }

  public boolean isBorder() {
    return border;
  }

  public void setBorder(boolean border) {
    this.border = border;
  }

  public Double getSegmentDistanceKmToNext() {
    return segmentDistanceKmToNext;
  }

  public void setSegmentDistanceKmToNext(Double segmentDistanceKmToNext) {
    this.segmentDistanceKmToNext = segmentDistanceKmToNext;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}

