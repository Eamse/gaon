/**
 * 환경변수 검증 모듈
 * 서버 시작 전 필수 환경변수가 모두 설정되어 있는지 확인합니다.
 * 누락 시 명확한 에러 메시지와 함께 프로세스를 종료합니다.
 */

/**
 * 필수 환경변수 목록
 * @type {Array<{key: string, description: string}>}
 */
const REQUIRED_ENV_VARS = [
    {
        key: 'JWT_SECRET',
        description: 'JWT 토큰 서명에 사용되는 비밀키 (최소 32자 권장)',
    },
    {
        key: 'DATABASE_URL',
        description: 'PostgreSQL 데이터베이스 연결 URL',
    },
    {
        key: 'R2_ACCOUNT_ID',
        description: 'Cloudflare R2 계정 ID',
    },
    {
        key: 'R2_ACCESS_KEY_ID',
        description: 'Cloudflare R2 액세스 키 ID',
    },
    {
        key: 'R2_SECRET_ACCESS_KEY',
        description: 'Cloudflare R2 시크릿 액세스 키',
    },
    {
        key: 'R2_BUCKET_NAME',
        description: 'Cloudflare R2 버킷 이름',
    },
];

/**
 * 선택적 환경변수 (기본값 제공)
 * @type {Array<{key: string, defaultValue: string, description: string}>}
 */
const OPTIONAL_ENV_VARS = [
    {
        key: 'PORT',
        defaultValue: '4000',
        description: '서버 포트 번호',
    },
    {
        key: 'NODE_ENV',
        defaultValue: 'development',
        description: '실행 환경 (development, production)',
    },
    {
        key: 'VISIT_SALT',
        defaultValue: 'visit-salt',
        description: '방문자 IP 해싱용 salt',
    },
    {
        key: 'ENABLE_API_DOCS',
        defaultValue: 'true',
        description: 'API 문서 활성화 여부 (true/false)',
    },
];

/**
 * 환경변수를 검증하고 누락된 항목을 확인합니다.
 * @throws {Error} 필수 환경변수가 누락된 경우
 */
function validateEnv() {
    const missingVars = [];

    // 필수 환경변수 검증
    for (const { key, description } of REQUIRED_ENV_VARS) {
        if (!process.env[key] || process.env[key].trim() === '') {
            missingVars.push({ key, description });
        }
    }

    // 누락된 환경변수가 있으면 에러 발생
    if (missingVars.length > 0) {
        console.error('\n❌ 필수 환경변수가 설정되지 않았습니다:\n');
        missingVars.forEach(({ key, description }) => {
            console.error(`  - ${key}: ${description}`);
        });
        console.error('\n.env 파일을 확인하고 누락된 환경변수를 추가해주세요.\n');
        throw new Error('필수 환경변수 누락');
    }

    // JWT_SECRET 길이 검증 (보안 권장사항)
    if (process.env.JWT_SECRET.length < 32) {
        console.warn(
            '⚠️  경고: JWT_SECRET이 32자 미만입니다. 보안을 위해 더 긴 비밀키를 사용하는 것을 권장합니다.'
        );
    }

    console.log('✅ 모든 필수 환경변수가 설정되었습니다.');
}

/**
 * 선택적 환경변수에 기본값을 설정합니다.
 */
function setDefaultValues() {
    for (const { key, defaultValue } of OPTIONAL_ENV_VARS) {
        if (!process.env[key]) {
            process.env[key] = defaultValue;
        }
    }
}

/**
 * 환경변수를 로드하고 검증합니다.
 * 이 함수는 서버 시작 시 가장 먼저 호출되어야 합니다.
 */
export function loadAndValidateEnv() {
    validateEnv();
    setDefaultValues();
}

/**
 * 검증된 환경변수를 안전하게 가져옵니다.
 * @returns {Object} 환경변수 객체
 */
export const env = {
    // 필수 환경변수
    JWT_SECRET: process.env.JWT_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    SHADOW_DATABASE_URL: process.env.SHADOW_DATABASE_URL,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,

    // 선택적 환경변수
    PORT: process.env.PORT || '4000',
    NODE_ENV: process.env.NODE_ENV || 'development',
    VISIT_SALT: process.env.VISIT_SALT || 'visit-salt',
    ENABLE_API_DOCS: process.env.ENABLE_API_DOCS === 'true',

    // 관리자 Basic Auth (선택적)
    ADMIN_BASIC_USER: process.env.ADMIN_BASIC_USER,
    ADMIN_BASIC_PASS: process.env.ADMIN_BASIC_PASS,
};
