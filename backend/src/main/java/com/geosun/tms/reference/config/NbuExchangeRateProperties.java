package com.geosun.tms.reference.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.nbu")
public class NbuExchangeRateProperties {
  private String baseUrl = "https://bank.gov.ua/NBUStatService/v1/statdirectory";
  private int timeoutMillis = 10000;
  private int maxLookbackDays = 14;

  public String getBaseUrl() {
    return baseUrl;
  }

  public void setBaseUrl(String baseUrl) {
    this.baseUrl = baseUrl;
  }

  public int getTimeoutMillis() {
    return timeoutMillis;
  }

  public void setTimeoutMillis(int timeoutMillis) {
    this.timeoutMillis = timeoutMillis;
  }

  public int getMaxLookbackDays() {
    return maxLookbackDays;
  }

  public void setMaxLookbackDays(int maxLookbackDays) {
    this.maxLookbackDays = maxLookbackDays;
  }

  public String exchangeRatesPath() {
    return baseUrl + "/exchange";
  }
}
