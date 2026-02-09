/**
 * 입력값 검증 규칙 모듈
 * express-validator를 사용하여 각 도메인별 검증 규칙을 정의
 */

import { body, param, query, validationResult } from 'express-validator';

/**
 * 검증 결과를 확인하고 에러가 있으면 400 응답을 반환하는 미들웨어
 */
export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map((err) => ({
            field: err.path || err.param,
            message: err.msg,
        }));
        return res.status(400).json({
            ok: false,
            error: '입력값이 올바르지 않습니다.',
            details: errorMessages,
        });
    }
    next();
};

// ==================== 사용자 인증 검증 ====================

/**
 * 로그인 요청 검증 규칙
 */
export const loginValidation = [
    body('username')
        .trim()
        .notEmpty()
        .withMessage('사용자명을 입력해주세요.')
        .isLength({ min: 3, max: 50 })
        .withMessage('사용자명은 3-50자 사이여야 합니다.'),

    body('password')
        .notEmpty()
        .withMessage('비밀번호를 입력해주세요.')
        .isLength({ min: 6 })
        .withMessage('비밀번호는 최소 6자 이상이어야 합니다.'),
];

// ==================== 프로젝트 검증 ====================

/**
 * 프로젝트 생성 검증 규칙
 */
export const createProjectValidation = [
    body('title')
        .trim()
        .notEmpty()
        .withMessage('프로젝트 제목을 입력해주세요.')
        .isLength({ max: 200 })
        .withMessage('제목은 200자를 초과할 수 없습니다.'),

    body('category')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('카테고리는 50자를 초과할 수 없습니다.'),

    body('location')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('위치는 100자를 초과할 수 없습니다.'),

    body('year')
        .optional()
        .customSanitizer(value => {
            // 숫자 또는 문자열 숫자를 정수로 변환
            if (value === null || value === undefined || value === '') return null;
            const num = typeof value === 'number' ? value : parseInt(value, 10);
            return isNaN(num) ? null : num;
        })
        .custom(value => {
            if (value === null) return true; // optional이므로 null 허용
            if (value < 1900 || value > 2100) {
                throw new Error('연도는 1900-2100 사이여야 합니다.');
            }
            return true;
        }),

    body('area')
        .optional()
        .customSanitizer(value => {
            // 숫자 또는 문자열 숫자를 실수로 변환
            if (value === null || value === undefined || value === '') return null;
            const num = typeof value === 'number' ? value : parseFloat(value);
            return isNaN(num) ? null : num;
        })
        .custom(value => {
            if (value === null) return true; // optional이므로 null 허용
            if (value < 0) {
                throw new Error('면적은 0 이상이어야 합니다.');
            }
            return true;
        }),

    body('price')
        .optional()
        .customSanitizer(value => {
            // 숫자 또는 문자열 숫자를 정수로 변환
            if (value === null || value === undefined || value === '') return null;
            const num = typeof value === 'number' ? value : parseInt(value, 10);
            return isNaN(num) ? null : num;
        })
        .custom(value => {
            if (value === null) return true; // optional이므로 null 허용
            if (value < 0) {
                throw new Error('가격은 0 이상이어야 합니다.');
            }
            return true;
        }),
];

/**
 * 프로젝트 수정 검증 규칙
 */
export const updateProjectValidation = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('유효한 프로젝트 ID를 입력해주세요.'),

    ...createProjectValidation.map((validator) => validator.optional()),
];

/**
 * 프로젝트 ID 파라미터 검증
 */
export const projectIdValidation = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('유효한 프로젝트 ID를 입력해주세요.'),
];

// ==================== 문의 검증 ====================

/**
 * 문의 생성 검증 규칙
 */
export const createInquiryValidation = [
    body('userName')
        .trim()
        .notEmpty()
        .withMessage('이름을 입력해주세요.')
        .isLength({ max: 50 })
        .withMessage('이름은 50자를 초과할 수 없습니다.'),

    body('userPhone')
        .trim()
        .notEmpty()
        .withMessage('전화번호를 입력해주세요.')
        .matches(/^[0-9-+() ]{8,20}$/)
        .withMessage('올바른 전화번호 형식을 입력해주세요. (8-20자, 숫자와 -, +, (), 공백만 허용)'),

    body('spaceType')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('공간 타입은 50자를 초과할 수 없습니다.'),

    body('areaSize')
        .optional()
        .isInt({ min: 0 })
        .withMessage('면적은 0 이상의 정수여야 합니다.'),

    body('location')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('위치는 100자를 초과할 수 없습니다.'),

    body('budget')
        .optional()
        .isInt({ min: 0 })
        .withMessage('예산은 0 이상의 정수여야 합니다.'),

    body('requests')
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage('요청 사항은 2000자를 초과할 수 없습니다.'),
];

/**
 * 문의 상태 업데이트 검증 규칙
 */
export const updateInquiryValidation = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('유효한 문의 ID를 입력해주세요.'),

    body('status')
        .optional()
        .isIn(['new', 'processing', 'completed', 'cancelled'])
        .withMessage('상태는 new, processing, completed, cancelled 중 하나여야 합니다.'),

    body('adminMemo')
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage('관리자 메모는 2000자를 초과할 수 없습니다.'),
];

// ==================== 이미지 업로드 검증 ====================

/**
 * 이미지 메타데이터 수정 검증 규칙
 */
export const updateImageMetaValidation = [
    param('filename')
        .trim()
        .notEmpty()
        .withMessage('파일명을 입력해주세요.'),

    body('title')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage('제목은 200자를 초과할 수 없습니다.'),

    body('category')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('카테고리는 50자를 초과할 수 없습니다.'),
];

// ==================== 페이지네이션 검증 ====================

/**
 * 페이지네이션 쿼리 파라미터 검증
 */
export const paginationValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('페이지는 1 이상의 정수여야 합니다.'),

    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('limit는 1-100 사이의 정수여야 합니다.'),

    query('sort')
        .optional()
        .isIn(['createdAt', 'updatedAt', 'title', 'category'])
        .withMessage('정렬 기준이 올바르지 않습니다.'),

    query('order')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('정렬 순서는 asc 또는 desc여야 합니다.'),
];
