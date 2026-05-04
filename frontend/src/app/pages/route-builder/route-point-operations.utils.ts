import { RoutePointOperation, Waypoint } from './route-builder.models';

/**
 * Дзеркало правил валідації операцій точки маршруту з бекенда
 * (com.geosun.tms.routes.domain.RoutePointOperationsRules).
 *
 * Правила:
 *  - не більше 2 операцій на точці;
 *  - whitelist залежить від типу точки (BORDER vs не-BORDER);
 *  - на маршрут допустимо максимум 1 BORDER-точка;
 *  - якщо BORDER відсутній — заборонені будь-які митні операції;
 *  - якщо BORDER присутній — EXPORT має бути на індексі ≤ b, IMPORT на індексі ≥ b;
 *  - фазова FSM LOAD_PHASE -> CUSTOMS_TRANSIT -> UNLOAD_PHASE.
 */

export const MAX_OPS_PER_POINT = 2;
export const MAX_BORDER_POINTS_PER_ROUTE = 1;

export type RoutePointOperationsErrorCode =
  | 'OPERATION_SET_INVALID'
  | 'BORDER_TOO_MANY'
  | 'CUSTOMS_WITHOUT_BORDER'
  | 'MISSING_EXPORT_BEFORE_BORDER'
  | 'MISSING_IMPORT_AFTER_BORDER'
  | 'IMPORT_BEFORE_EXPORT'
  | 'OPERATION_IN_TRANSIT'
  | 'UNCLOSED_CUSTOMS'
  | 'OPERATION_AFTER_UNLOAD';

export interface RoutePointOperationsError {
  code: RoutePointOperationsErrorCode;
  pointIndex: number;
}

export interface ValidationPoint {
  isBorder: boolean;
  operations: RoutePointOperation[];
}

const ALLOWED_NON_BORDER: ReadonlyArray<ReadonlyArray<RoutePointOperation>> = [
  [],
  ['LOADING'],
  ['EXPORT_CUSTOMS'],
  ['IMPORT_CUSTOMS'],
  ['UNLOADING'],
  ['LOADING', 'EXPORT_CUSTOMS'],
  ['IMPORT_CUSTOMS', 'UNLOADING']
];

const ALLOWED_BORDER: ReadonlyArray<ReadonlyArray<RoutePointOperation>> = [
  [],
  ['EXPORT_CUSTOMS'],
  ['IMPORT_CUSTOMS'],
  ['EXPORT_CUSTOMS', 'IMPORT_CUSTOMS']
];

function setsEqual(a: readonly RoutePointOperation[], b: readonly RoutePointOperation[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((op, idx) => op === sortedB[idx]);
}

export function isOperationSetAllowed(isBorder: boolean, ops: readonly RoutePointOperation[]): boolean {
  const whitelist = isBorder ? ALLOWED_BORDER : ALLOWED_NON_BORDER;
  return whitelist.some((allowed) => setsEqual(allowed, ops));
}

/** Допустимі набори опцій для побудови UI-чекбоксів. */
export function getAllowedOperationsForPoint(isBorder: boolean): RoutePointOperation[] {
  return isBorder ? ['EXPORT_CUSTOMS', 'IMPORT_CUSTOMS'] : ['LOADING', 'EXPORT_CUSTOMS', 'IMPORT_CUSTOMS', 'UNLOADING'];
}

export function validateRouteOperations(points: readonly ValidationPoint[]): RoutePointOperationsError | null {
  if (!points || points.length === 0) {
    return null;
  }

  // 1. Per-point whitelist
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (point.operations.length > MAX_OPS_PER_POINT) {
      return { code: 'OPERATION_SET_INVALID', pointIndex: i };
    }
    if (!isOperationSetAllowed(point.isBorder, point.operations)) {
      return { code: 'OPERATION_SET_INVALID', pointIndex: i };
    }
  }

  // 2. Глобальні правила про BORDER
  let borderCount = 0;
  let borderIndex = -1;
  for (let i = 0; i < points.length; i++) {
    if (points[i].isBorder) {
      borderCount++;
      borderIndex = i;
    }
  }

  if (borderCount > MAX_BORDER_POINTS_PER_ROUTE) {
    return { code: 'BORDER_TOO_MANY', pointIndex: -1 };
  }

  const hasAnyCustoms = points.some(
    (p) => p.operations.includes('EXPORT_CUSTOMS') || p.operations.includes('IMPORT_CUSTOMS')
  );

  if (borderCount === 0) {
    if (hasAnyCustoms) {
      const idx = points.findIndex(
        (p) => p.operations.includes('EXPORT_CUSTOMS') || p.operations.includes('IMPORT_CUSTOMS')
      );
      return { code: 'CUSTOMS_WITHOUT_BORDER', pointIndex: idx };
    }
  } else {
    let exportBeforeOrAtBorder = false;
    let importAtOrAfterBorder = false;
    for (let i = 0; i < points.length; i++) {
      const ops = points[i].operations;
      if (i <= borderIndex && ops.includes('EXPORT_CUSTOMS')) {
        exportBeforeOrAtBorder = true;
      }
      if (i >= borderIndex && ops.includes('IMPORT_CUSTOMS')) {
        importAtOrAfterBorder = true;
      }
    }
    if (!exportBeforeOrAtBorder) {
      return { code: 'MISSING_EXPORT_BEFORE_BORDER', pointIndex: borderIndex };
    }
    if (!importAtOrAfterBorder) {
      return { code: 'MISSING_IMPORT_AFTER_BORDER', pointIndex: borderIndex };
    }
  }

  // 3. Фазова FSM
  type Phase = 'LOAD_PHASE' | 'CUSTOMS_TRANSIT' | 'UNLOAD_PHASE';
  let phase: Phase = 'LOAD_PHASE';

  for (let i = 0; i < points.length; i++) {
    const ops = points[i].operations;
    const hasLoading = ops.includes('LOADING');
    const hasExport = ops.includes('EXPORT_CUSTOMS');
    const hasImport = ops.includes('IMPORT_CUSTOMS');
    const hasUnloading = ops.includes('UNLOADING');

    switch (phase) {
      case 'LOAD_PHASE':
        if (hasImport && !hasExport) {
          return { code: 'IMPORT_BEFORE_EXPORT', pointIndex: i };
        }
        if (hasExport && hasImport) {
          phase = 'UNLOAD_PHASE';
        } else if (hasExport) {
          phase = 'CUSTOMS_TRANSIT';
        } else if (hasUnloading) {
          phase = 'UNLOAD_PHASE';
        }
        break;
      case 'CUSTOMS_TRANSIT':
        if (hasLoading || hasExport || (hasUnloading && !hasImport)) {
          return { code: 'OPERATION_IN_TRANSIT', pointIndex: i };
        }
        if (hasImport) {
          phase = 'UNLOAD_PHASE';
        }
        break;
      case 'UNLOAD_PHASE':
        if (hasLoading || hasExport || hasImport) {
          return { code: 'OPERATION_AFTER_UNLOAD', pointIndex: i };
        }
        break;
    }
  }

  if (phase === 'CUSTOMS_TRANSIT') {
    return { code: 'UNCLOSED_CUSTOMS', pointIndex: points.length - 1 };
  }
  return null;
}

/** Швидкий хелпер: валідація з масиву Waypoint. */
export function validateWaypointOperations(waypoints: readonly Waypoint[]): RoutePointOperationsError | null {
  return validateRouteOperations(
    waypoints.map((wp) => ({ isBorder: wp.isBorder, operations: wp.operations ?? [] }))
  );
}

/**
 * Чи варто додавати операцію до поточного набору. Перевіряє:
 *  - ліміт 2 операцій;
 *  - whitelist для цього типу точки.
 * Повертає null якщо додавання валідне, інакше — код проблеми.
 */
export function checkSetOperationsForPoint(
  isBorder: boolean,
  ops: readonly RoutePointOperation[]
): RoutePointOperationsErrorCode | null {
  if (ops.length > MAX_OPS_PER_POINT) {
    return 'OPERATION_SET_INVALID';
  }
  if (!isOperationSetAllowed(isBorder, ops)) {
    return 'OPERATION_SET_INVALID';
  }
  return null;
}
