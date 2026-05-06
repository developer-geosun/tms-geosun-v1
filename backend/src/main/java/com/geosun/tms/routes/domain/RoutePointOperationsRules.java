package com.geosun.tms.routes.domain;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * Правила валідації операцій точок маршруту.
 *
 * <p>Перевіряє:
 *
 * <ul>
 *   <li>per-point whitelist (різний для BORDER vs не-BORDER);
 *   <li>глобальні правила про BORDER (рівно 0 або 1 BORDER на маршрут, пов'язана з наявністю
 *       митних операцій);
 *   <li>фазову FSM {@code LOAD_PHASE -> CUSTOMS_TRANSIT -> UNLOAD_PHASE}.
 * </ul>
 */
public final class RoutePointOperationsRules {

  /** Максимальна кількість операцій на одній точці. */
  public static final int MAX_OPS_PER_POINT = 2;

  /** Максимальна кількість BORDER-точок на маршрут. */
  public static final int MAX_BORDER_POINTS_PER_ROUTE = 1;

  /** Whitelist допустимих наборів операцій на не-BORDER точці (START/STOP/FINISH). */
  private static final Set<Set<RoutePointOperation>> ALLOWED_NON_BORDER =
      Set.of(
          EnumSet.noneOf(RoutePointOperation.class),
          EnumSet.of(RoutePointOperation.LOADING),
          EnumSet.of(RoutePointOperation.EXPORT_CUSTOMS),
          EnumSet.of(RoutePointOperation.IMPORT_CUSTOMS),
          EnumSet.of(RoutePointOperation.UNLOADING),
          EnumSet.of(RoutePointOperation.LOADING, RoutePointOperation.UNLOADING),
          EnumSet.of(RoutePointOperation.LOADING, RoutePointOperation.EXPORT_CUSTOMS),
          EnumSet.of(RoutePointOperation.IMPORT_CUSTOMS, RoutePointOperation.UNLOADING));

  /** Whitelist допустимих наборів операцій на BORDER-точці (вантажні операції заборонені). */
  private static final Set<Set<RoutePointOperation>> ALLOWED_BORDER =
      Set.of(
          EnumSet.noneOf(RoutePointOperation.class),
          EnumSet.of(RoutePointOperation.EXPORT_CUSTOMS),
          EnumSet.of(RoutePointOperation.IMPORT_CUSTOMS),
          EnumSet.of(RoutePointOperation.EXPORT_CUSTOMS, RoutePointOperation.IMPORT_CUSTOMS));

  private RoutePointOperationsRules() {}

  /** Чи входить набір операцій до whitelist для заданого типу точки. */
  public static boolean isOperationSetAllowed(RoutePointKind kind, Set<RoutePointOperation> ops) {
    Set<RoutePointOperation> normalized =
        ops.isEmpty() ? EnumSet.noneOf(RoutePointOperation.class) : EnumSet.copyOf(ops);
    Set<Set<RoutePointOperation>> whitelist =
        kind == RoutePointKind.BORDER ? ALLOWED_BORDER : ALLOWED_NON_BORDER;
    return whitelist.contains(normalized);
  }

  /**
   * Виконати повну валідацію маршруту. Точки очікуються відсортованими за {@code order}.
   *
   * @return перший знайдений код помилки, або {@code null} якщо все гаразд.
   */
  public static ValidationError validateRoute(List<RoutePointWithOperations> points) {
    if (points == null || points.isEmpty()) {
      return null;
    }

    // 1. Per-point whitelist
    for (int i = 0; i < points.size(); i++) {
      RoutePointWithOperations point = points.get(i);
      Set<RoutePointOperation> ops = point.operations();
      if (ops.size() > MAX_OPS_PER_POINT) {
        return new ValidationError(ValidationErrorCode.OPERATION_SET_INVALID, i);
      }
      if (!isOperationSetAllowed(point.kind(), ops)) {
        return new ValidationError(ValidationErrorCode.OPERATION_SET_INVALID, i);
      }
    }

    // 2. Глобальні правила про BORDER
    int borderCount = 0;
    int borderIndex = -1;
    for (int i = 0; i < points.size(); i++) {
      if (points.get(i).kind() == RoutePointKind.BORDER) {
        borderCount++;
        borderIndex = i;
      }
    }
    if (borderCount > MAX_BORDER_POINTS_PER_ROUTE) {
      return new ValidationError(ValidationErrorCode.BORDER_TOO_MANY, -1);
    }

    boolean hasAnyCustoms =
        points.stream()
            .anyMatch(
                point ->
                    point.operations().contains(RoutePointOperation.EXPORT_CUSTOMS)
                        || point.operations().contains(RoutePointOperation.IMPORT_CUSTOMS));

    if (borderCount == 0) {
      if (hasAnyCustoms) {
        for (int i = 0; i < points.size(); i++) {
          Set<RoutePointOperation> ops = points.get(i).operations();
          if (ops.contains(RoutePointOperation.EXPORT_CUSTOMS)
              || ops.contains(RoutePointOperation.IMPORT_CUSTOMS)) {
            return new ValidationError(ValidationErrorCode.CUSTOMS_WITHOUT_BORDER, i);
          }
        }
      }
    } else {
      // borderCount == 1
      boolean exportBeforeOrAtBorder = false;
      boolean importAtOrAfterBorder = false;
      for (int i = 0; i < points.size(); i++) {
        Set<RoutePointOperation> ops = points.get(i).operations();
        if (i <= borderIndex && ops.contains(RoutePointOperation.EXPORT_CUSTOMS)) {
          exportBeforeOrAtBorder = true;
        }
        if (i >= borderIndex && ops.contains(RoutePointOperation.IMPORT_CUSTOMS)) {
          importAtOrAfterBorder = true;
        }
      }
      if (!exportBeforeOrAtBorder) {
        return new ValidationError(ValidationErrorCode.MISSING_EXPORT_BEFORE_BORDER, borderIndex);
      }
      if (!importAtOrAfterBorder) {
        return new ValidationError(ValidationErrorCode.MISSING_IMPORT_AFTER_BORDER, borderIndex);
      }
    }

    // 3. Фазова FSM
    Phase phase = Phase.LOAD_PHASE;
    for (int i = 0; i < points.size(); i++) {
      Set<RoutePointOperation> ops = points.get(i).operations();
      boolean hasLoading = ops.contains(RoutePointOperation.LOADING);
      boolean hasExport = ops.contains(RoutePointOperation.EXPORT_CUSTOMS);
      boolean hasImport = ops.contains(RoutePointOperation.IMPORT_CUSTOMS);
      boolean hasUnloading = ops.contains(RoutePointOperation.UNLOADING);

      switch (phase) {
        case LOAD_PHASE -> {
          if (hasImport && !hasExport) {
            return new ValidationError(ValidationErrorCode.IMPORT_BEFORE_EXPORT, i);
          }
          if (hasExport && hasImport) {
            // BORDER з {EXPORT, IMPORT} закриває митне вікно одразу
            phase = Phase.UNLOAD_PHASE;
          } else if (hasExport) {
            phase = Phase.CUSTOMS_TRANSIT;
          } else if (hasUnloading) {
            phase = Phase.UNLOAD_PHASE;
          }
        }
        case CUSTOMS_TRANSIT -> {
          if (hasLoading || hasExport || (hasUnloading && !hasImport)) {
            return new ValidationError(ValidationErrorCode.OPERATION_IN_TRANSIT, i);
          }
          if (hasImport) {
            phase = Phase.UNLOAD_PHASE;
          }
        }
        case UNLOAD_PHASE -> {
          if (hasLoading || hasExport || hasImport) {
            return new ValidationError(ValidationErrorCode.OPERATION_AFTER_UNLOAD, i);
          }
        }
      }
    }
    if (phase == Phase.CUSTOMS_TRANSIT) {
      return new ValidationError(ValidationErrorCode.UNCLOSED_CUSTOMS, points.size() - 1);
    }
    return null;
  }

  /** Внутрішнє представлення фази FSM. */
  private enum Phase {
    LOAD_PHASE,
    CUSTOMS_TRANSIT,
    UNLOAD_PHASE
  }

  /** Адаптер для алгоритму валідації — пара (тип точки, набір операцій). */
  public record RoutePointWithOperations(RoutePointKind kind, Set<RoutePointOperation> operations) {
    public RoutePointWithOperations {
      operations = operations == null ? EnumSet.noneOf(RoutePointOperation.class) : operations;
    }
  }

  /** Результат однієї невдалої перевірки. */
  public record ValidationError(ValidationErrorCode code, int pointIndex) {}

  /** Стабільні коди помилок валідації для API. */
  public enum ValidationErrorCode {
    OPERATION_SET_INVALID,
    BORDER_TOO_MANY,
    CUSTOMS_WITHOUT_BORDER,
    MISSING_EXPORT_BEFORE_BORDER,
    MISSING_IMPORT_AFTER_BORDER,
    IMPORT_BEFORE_EXPORT,
    OPERATION_IN_TRANSIT,
    UNCLOSED_CUSTOMS,
    OPERATION_AFTER_UNLOAD
  }
}
