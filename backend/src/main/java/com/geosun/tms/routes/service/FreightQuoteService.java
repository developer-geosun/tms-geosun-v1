package com.geosun.tms.routes.service;

import com.geosun.tms.auth.domain.user.User;
import com.geosun.tms.auth.exception.ApiException;
import com.geosun.tms.auth.repository.UserRepository;
import com.geosun.tms.routes.domain.FreightQuote;
import com.geosun.tms.routes.domain.QuoteIdempotencyKey;
import com.geosun.tms.routes.domain.RouteRequest;
import com.geosun.tms.routes.domain.RouteRequestStatusHistory;
import com.geosun.tms.routes.dto.QuoteStatus;
import com.geosun.tms.routes.dto.RouteRequestStatus;
import com.geosun.tms.routes.dto.request.CreateQuoteRequest;
import com.geosun.tms.routes.dto.response.QuoteDto;
import com.geosun.tms.routes.repository.FreightQuoteRepository;
import com.geosun.tms.routes.repository.QuoteIdempotencyKeyRepository;
import com.geosun.tms.routes.repository.RouteRequestRepository;
import com.geosun.tms.routes.repository.RouteRequestStatusHistoryRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class FreightQuoteService {
  private static final String OP_CREATE = "CREATE_DRAFT";
  private static final String OP_SEND = "SEND";

  private final RouteRequestRepository routeRequestRepository;
  private final FreightQuoteRepository freightQuoteRepository;
  private final QuoteIdempotencyKeyRepository quoteIdempotencyKeyRepository;
  private final RouteRequestStatusHistoryRepository routeRequestStatusHistoryRepository;
  private final UserRepository userRepository;

  public FreightQuoteService(
      RouteRequestRepository routeRequestRepository,
      FreightQuoteRepository freightQuoteRepository,
      QuoteIdempotencyKeyRepository quoteIdempotencyKeyRepository,
      RouteRequestStatusHistoryRepository routeRequestStatusHistoryRepository,
      UserRepository userRepository) {
    this.routeRequestRepository = routeRequestRepository;
    this.freightQuoteRepository = freightQuoteRepository;
    this.quoteIdempotencyKeyRepository = quoteIdempotencyKeyRepository;
    this.routeRequestStatusHistoryRepository = routeRequestStatusHistoryRepository;
    this.userRepository = userRepository;
  }

  @Transactional
  public QuoteDto createDraftQuote(
      String requestId, String adminUserId, String idempotencyKey, CreateQuoteRequest request) {
    String key = requireIdempotencyKey(idempotencyKey);
    QuoteIdempotencyKey existing = loadIdempotency(OP_CREATE, key, adminUserId);
    if (existing != null && existing.getQuote() != null) {
      return toDto(existing.getQuote());
    }

    User adminUser =
        userRepository
            .findById(adminUserId)
            .orElseThrow(() -> ApiException.notFound("User not found"));
    RouteRequest routeRequest =
        routeRequestRepository
            .findById(requestId)
            .orElseThrow(() -> ApiException.notFound("Route request not found"));

    FreightQuote quote = new FreightQuote();
    quote.setRequest(routeRequest);
    quote.setAdminUser(adminUser);
    quote.setCurrency(request.currency().trim().toUpperCase());
    quote.setTotalAmount(BigDecimal.valueOf(request.totalAmount()));
    quote.setTransitDaysMin(request.transitDaysMin());
    quote.setTransitDaysMax(request.transitDaysMax());
    quote.setValidUntil(parseDateOrNull(request.validUntil()));
    quote.setPublicNote(request.publicNote());
    quote.setInternalNote(request.internalNote());
    quote.setStatus(QuoteStatus.DRAFT);
    FreightQuote saved = freightQuoteRepository.save(quote);

    if (routeRequest.getStatus() == RouteRequestStatus.NEW) {
      appendRequestStatusHistory(
          routeRequest,
          routeRequest.getStatus(),
          RouteRequestStatus.IN_REVIEW,
          adminUser,
          "Draft created");
      routeRequest.setStatus(RouteRequestStatus.IN_REVIEW);
    }

    persistIdempotency(OP_CREATE, key, adminUser, routeRequest, saved);
    return toDto(saved);
  }

  @Transactional
  public QuoteDto sendQuote(String quoteId, String adminUserId, String idempotencyKey) {
    String key = requireIdempotencyKey(idempotencyKey);
    QuoteIdempotencyKey existing = loadIdempotency(OP_SEND, key, adminUserId);
    if (existing != null && existing.getQuote() != null) {
      return toDto(existing.getQuote());
    }

    User adminUser =
        userRepository
            .findById(adminUserId)
            .orElseThrow(() -> ApiException.notFound("User not found"));
    FreightQuote quote =
        freightQuoteRepository
            .findById(quoteId)
            .orElseThrow(() -> ApiException.notFound("Quote not found"));
    if (quote.getStatus() == QuoteStatus.SENT) {
      persistIdempotency(OP_SEND, key, adminUser, quote.getRequest(), quote);
      return toDto(quote);
    }
    if (quote.getStatus() != QuoteStatus.DRAFT) {
      throw ApiException.conflict("Only draft quote can be sent");
    }

    List<FreightQuote> sentQuotes =
        freightQuoteRepository.findByRequestIdAndStatus(
            quote.getRequest().getId(), QuoteStatus.SENT);
    for (FreightQuote sent : sentQuotes) {
      sent.setStatus(QuoteStatus.SUPERSEDED);
    }

    quote.setStatus(QuoteStatus.SENT);
    quote.setSentAt(Instant.now());
    freightQuoteRepository.save(quote);

    RouteRequest routeRequest = quote.getRequest();
    RouteRequestStatus fromStatus = routeRequest.getStatus();
    routeRequest.setStatus(RouteRequestStatus.QUOTED);
    appendRequestStatusHistory(
        routeRequest, fromStatus, RouteRequestStatus.QUOTED, adminUser, "Quote sent");

    persistIdempotency(OP_SEND, key, adminUser, routeRequest, quote);
    return toDto(quote);
  }

  @Transactional(readOnly = true)
  public List<QuoteDto> getQuotesForRequest(String requestId) {
    routeRequestRepository
        .findById(requestId)
        .orElseThrow(() -> ApiException.notFound("Route request not found"));
    return freightQuoteRepository.findByRequestIdOrderByCreatedAtDesc(requestId).stream()
        .map(this::toDto)
        .toList();
  }

  @Transactional(readOnly = true)
  public QuoteDto getCurrentQuoteForRequest(String requestId) {
    return freightQuoteRepository
        .findFirstByRequestIdAndStatusInOrderByCreatedAtDesc(
            requestId, List.of(QuoteStatus.SENT, QuoteStatus.DRAFT))
        .map(this::toDto)
        .orElse(null);
  }

  private void appendRequestStatusHistory(
      RouteRequest request,
      RouteRequestStatus from,
      RouteRequestStatus to,
      User actor,
      String note) {
    RouteRequestStatusHistory history = new RouteRequestStatusHistory();
    history.setRequest(request);
    history.setFromStatus(from);
    history.setToStatus(to);
    history.setChangedBy(actor);
    history.setNote(note);
    routeRequestStatusHistoryRepository.save(history);
  }

  private QuoteIdempotencyKey loadIdempotency(String operation, String key, String actorUserId) {
    return quoteIdempotencyKeyRepository
        .findByOperationTypeAndIdempotencyKeyAndActorUserId(operation, key, actorUserId)
        .orElse(null);
  }

  private void persistIdempotency(
      String operation, String key, User actor, RouteRequest request, FreightQuote quote) {
    QuoteIdempotencyKey existing = loadIdempotency(operation, key, actor.getId());
    if (existing != null) {
      return;
    }
    QuoteIdempotencyKey entry = new QuoteIdempotencyKey();
    entry.setOperationType(operation);
    entry.setIdempotencyKey(key);
    entry.setActorUser(actor);
    entry.setRequest(request);
    entry.setQuote(quote);
    quoteIdempotencyKeyRepository.save(entry);
  }

  private static String requireIdempotencyKey(String idempotencyKey) {
    if (!StringUtils.hasText(idempotencyKey)) {
      throw ApiException.badRequest(
          "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required");
    }
    return idempotencyKey.trim();
  }

  private static LocalDate parseDateOrNull(String rawDate) {
    if (!StringUtils.hasText(rawDate)) {
      return null;
    }
    try {
      return LocalDate.parse(rawDate);
    } catch (DateTimeParseException ex) {
      throw ApiException.badRequest("VALIDATION_ERROR", "Invalid validUntil format");
    }
  }

  private QuoteDto toDto(FreightQuote quote) {
    return new QuoteDto(
        quote.getId(),
        quote.getRequest().getId(),
        quote.getCurrency(),
        quote.getTotalAmount().doubleValue(),
        quote.getTransitDaysMin(),
        quote.getTransitDaysMax(),
        quote.getValidUntil() == null ? null : quote.getValidUntil().toString(),
        quote.getStatus(),
        quote.getPublicNote(),
        quote.getCreatedAt() == null ? null : quote.getCreatedAt().toString(),
        quote.getSentAt() == null ? null : quote.getSentAt().toString());
  }
}
