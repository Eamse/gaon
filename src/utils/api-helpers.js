/**
 * 백엔드 API 공통 유틸리티 함수
 * @module api-helpers
 */

/**
 * 페이지네이션 파라미터 계산
 * @param {number} page - 페이지 번호 (1부터 시작)
 * @param {number} limit - 페이지당 항목 수
 * @returns {{skip: number, take: number}} Prisma용 페이지네이션 객체
 * 
 * @example
 * const { skip, take } = getPagination(2, 10);
 * // { skip: 10, take: 10 } - 2페이지, 페이지당 10개
 */
export function getPagination(page = 1, limit = 10) {
    const parsedPage = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10))); // 최대 100개 제한

    return {
        skip: (parsedPage - 1) * parsedLimit,
        take: parsedLimit,
    };
}

/**
 * 정렬 파라미터 파싱
 * @param {string} sort - 정렬 기준 필드
 * @param {string} order - 정렬 순서 (asc/desc)
 * @param {string[]} allowedFields - 허용된 정렬 필드 목록
 * @param {string} defaultField - 기본 정렬 필드
 * @returns {{[key:string]: string}} Prisma용 정렬 객체
 * 
 * @example
 * const orderBy = getSortParams('createdAt', 'desc', ['createdAt', 'title'], 'createdAt');
 * // { createdAt: 'desc' }
 */
export function getSortParams(sort, order = 'desc', allowedFields = [], defaultField = 'createdAt') {
    const field = allowedFields.includes(sort) ? sort : defaultField;
    const direction = ['asc', 'desc'].includes(order) ? order : 'desc';

    return { [field]: direction };
}

/**
 * API 성공 응답 생성
 * @param {*} data - 응답 데이터
 * @param {string} [message] - 선택적 메시지
 * @returns {{ok: boolean, data: *, message?: string}}
 * 
 * @example
 * return res.json(successResponse(projects, '프로젝트 목록 조회 성공'));
 */
export function successResponse(data, message) {
    const response = { ok: true, data };
    if (message) response.message = message;
    return response;
}

/**
 * API 에러 응답 생성
 * @param {string} error - 에러 메시지
 * @param {*} [details] - 추가 에러 상세 정보
 * @returns {{ok: boolean, error: string, details?: *}}
 * 
 * @example
 * return res.status(400).json(errorResponse('잘못된 요청입니다.'));
 */
export function errorResponse(error, details) {
    const response = { ok: false, error };
    if (details) response.details = details;
    return response;
}

/**
 * Prisma 에러를 사용자 친화적인 메시지로 변환
 * @param {Error} error - Prisma 에러 객체
 * @returns {{status: number, message: string}}
 * 
 * @example
 * catch (error) {
 *   const { status, message } = handlePrismaError(error);
 *   return res.status(status).json(errorResponse(message));
 * }
 */
export function handlePrismaError(error) {
    // Prisma 에러 코드 참고: https://www.prisma.io/docs/reference/api-reference/error-reference

    if (error.code === 'P2002') {
        // Unique constraint 위반
        const field = error.meta?.target?.[0] || '필드';
        return {
            status: 409,
            message: `${field}가 이미 존재합니다.`,
        };
    }

    if (error.code === 'P2025') {
        // Record not found
        return {
            status: 404,
            message: '요청한 항목을 찾을 수 없습니다.',
        };
    }

    if (error.code === 'P2003') {
        // Foreign key constraint 위반
        return {
            status: 400,
            message: '참조 무결성 오류: 참조된 항목이 존재하지 않습니다.',
        };
    }

    if (error.code === 'P2014') {
        // Invalid ID
        return {
            status: 400,
            message: '유효하지 않은 ID입니다.',
        };
    }

    // 기타 Prisma 에러
    if (error.code && error.code.startsWith('P')) {
        return {
            status: 500,
            message: '데이터베이스 작업 중 오류가 발생했습니다.',
        };
    }

    // 일반 에러
    return {
        status: 500,
        message: error.message || '서버 오류가 발생했습니다.',
    };
}

/**
 * 필터 조건 빌더
 * @param {Object} filters - 필터 객체
 * @param {string[]} searchFields - 검색할 필드 목록
 * @returns {Object} Prisma WHERE 조건
 * 
 * @example
 * const where = buildFilters({ category: '주택', search: '강남' }, ['title', 'location']);
 * // { category: '주택', OR: [{ title: { contains: '강남' } }, { location: { contains: '강남' } }] }
 */
export function buildFilters(filters = {}, searchFields = []) {
    const where = {};

    // 카테고리 필터
    if (filters.category) {
        where.category = filters.category;
    }

    // 검색어 필터 (여러 필드에서 OR 검색)
    if (filters.search && searchFields.length > 0) {
        where.OR = searchFields.map(field => ({
            [field]: {
                contains: filters.search,
                mode: 'insensitive', // 대소문자 구분 안함 (PostgreSQL)
            },
        }));
    }

    // 상태 필터
    if (filters.status) {
        where.status = filters.status;
    }

    return where;
}

/**
 * 응답에 페이지네이션 메타데이터 추가
 * @param {Array} data - 응답 데이터 배열
 * @param {number} total - 전체 항목 수
 * @param {number} page - 현재 페이지
 * @param {number} limit - 페이지당 항목 수
 * @returns {Object} 페이지네이션 정보가 포함된 응답
 * 
 * @example
 * const response = paginatedResponse(projects, totalCount, 2, 10);
 * // { ok: true, data: [...], pagination: { ... } }
 */
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
