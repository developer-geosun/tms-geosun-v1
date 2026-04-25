package com.geosun.tms.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Параметри листів верифікації (app.email.*).
 */
@ConfigurationProperties(prefix = "app.email")
public class AppEmailProperties {

  private String from = "no-reply@example.com";

  private long verificationExpiresSeconds = 86400;
  private String verificationLinkBase = "http://localhost:4200/verify-email";

  public String getFrom() {
    return from;
  }

  public void setFrom(String from) {
    this.from = from;
  }

  public long getVerificationExpiresSeconds() {
    return verificationExpiresSeconds;
  }

  public void setVerificationExpiresSeconds(long verificationExpiresSeconds) {
    this.verificationExpiresSeconds = verificationExpiresSeconds;
  }

  public String getVerificationLinkBase() {
    return verificationLinkBase;
  }

  public void setVerificationLinkBase(String verificationLinkBase) {
    this.verificationLinkBase = verificationLinkBase;
  }
}
