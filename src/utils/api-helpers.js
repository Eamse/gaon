/** 페이지와 limit 값을 기반으로 Prisma의 skip, take 값을 계산합니다. */
export function getPagination(page = 1, limit = 10) {
  const parsedPage = Math.max(1, parseInt(page, 10));
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

  return {
    skip: (parsedPage - 1) * parsedLimit,
    take: parsedLimit,
  };
}

/** 정렬 관련 쿼리 파라미터를 Prisma의 orderBy 객체로 변환합니다. */
export function getSortParams(
  sort,
  order = 'desc',
  allowedFields = [],
  defaultField = 'createdAt',
) {
  const field = allowedFields.includes(sort) ? sort : defaultField;
  const direction = ['asc', 'desc'].includes(order) ? order : 'desc';

  return { [field]: direction };
}

/** API 성공 시 사용할 표준 응답 객체를 생성합니다. */
export function successResponse(data, message) {
  const response = { ok: true, data };
  if (message) response.message = message;
  return response;
}

/** API 실패 시 사용할 표준 에러 응답 객체를 생성합니다. */
export function errorResponse(error, details) {
  const response = { ok: false, error };
  if (details) response.details = details;
  return response;
}

/** Prisma 에러 코드를 분석하여 적절한 HTTP 상태 코드와 메시지를 반환합니다. */
export function handlePrismaError(error) {
  if (error.code === 'P2002') {
    const field = error.meta?.target?.[0] || '필드';
    return {
      status: 409,
      message: `${field}가 이미 존재합니다.`,
    };
  }

  if (error.code === 'P2025') {
    return {
      status: 404,
      message: '요청한 항목을 찾을 수 없습니다.',
    };
  }

  if (error.code === 'P2003') {
    return {
      status: 400,
      message: '참조 무결성 오류: 참조된 항목이 존재하지 않습니다.',
    };
  }

  if (error.code === 'P2014') {
    return {
      status: 400,
      message: '유효하지 않은 ID입니다.',
    };
  }

  if (error.code && error.code.startsWith('P')) {
    return {
      status: 500,
      message: '데이터베이스 작업 중 오류가 발생했습니다.',
    };
  }

  return {
    status: 500,
    message: error.message || '서버 오류가 발생했습니다.',
  };
}

/**
 * 쿼리 파라미터를 기반으로 Prisma의 WHERE 조건을 동적으로 생성합니다.
 */
export function buildFilters(filters = {}, searchFields = []) {
  const where = {};

  if (filters.category) {
    where.category = filters.category;
  }

  if (filters.search && searchFields.length > 0) {
    where.OR = searchFields.map((field) => ({
      [field]: {
        contains: filters.search,
        mode: 'insensitive',
      },
    }));
  }

  // 상태 필터
  if (filters.status) {
    where.status = filters.status;
  }

  return where;
}

/** 페이지네이션 메타데이터를 포함하는 표준 API 응답 객체를 생성합니다. */
export function paginatedResponse(data, total, page, limit) {
  const totalPages = Math.ceil(total / limit);

  return {
    ok: true,
    data,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}
