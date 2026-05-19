package com.geosun.tms.freight.service;

import com.geosun.tms.auth.exception.ApiException;
import com.geosun.tms.freight.config.VertexAiProperties;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

@Service
public class AiRateLimitService {
  private final int maxPerHour;
  private final Map<String, Deque<Instant>> buckets = new ConcurrentHashMap<>();

  public AiRateLimitService(VertexAiProperties properties) {
    this.maxPerHour = Math.max(1, properties.rateLimitPerHour());
  }

  public void checkAndRecord(String userId) {
    Instant now = Instant.now();
    Instant windowStart = now.minusSeconds(3600);
    Deque<Instant> deque =
        buckets.computeIfAbsent(userId, ignored -> new ArrayDeque<>());
    synchronized (deque) {
      while (!deque.isEmpty() && deque.peekFirst().isBefore(windowStart)) {
        deque.pollFirst();
      }
      if (deque.size() >= maxPerHour) {
        throw ApiException.tooManyRequests("AI calculation rate limit exceeded");
      }
      deque.addLast(now);
    }
  }
}
