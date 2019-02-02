import { unmarshal } from "./encoding";

export enum ErrorCode {
    // Crypto Errors
    INVALID_CONTAINER_DATA = "invalid_container_data",
    UNSUPPORTED_CONTAINER_VERSION = "unsupported_container_version",
    INVALID_ENCRYPTION_PARAMS = "invalid_encryption_params",
    INVALID_KEY_WRAP_PARAMS = "invalid_key_wrap_params",
    INVALID_KEY_PARAMS = "invalid_key_params",
    DECRYPTION_FAILED = "decryption_failed",
    ENCRYPTION_FAILED = "encryption_failed",
    NOT_SUPPORTED = "not_supported",
    PUBLIC_KEY_MISMATCH = "public_key_mismatch",
    MISSING_ACCESS = "missing_access",

    // Client Errors
    FAILED_CONNECTION = "failed_connection",
    UNEXPECTED_REDIRECT = "unexpected_redirect",

    // Server Errors
    BAD_REQUEST = "bad_request",
    INVALID_SESSION = "invalid_session",
    SESSION_EXPIRED = "session_expired",
    DEPRECATED_API_VERSION = "deprecated_api_version",
    INSUFFICIENT_PERMISSIONS = "insufficient_permissions",
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded",
    INVALID_CREDENTIALS = "invalid_credentials",
    ACCOUNT_EXISTS = "account_exists",
    EMAIL_VERIFICATION_FAILED = "email_verification_failed",
    INVALID_RESPONSE = "invalid_response",
    INVALID_REQUEST = "invalid_request",
    MERGE_CONFLICT = "merge_conflict",
    MAX_REQUEST_SIZE_EXCEEDED = "max_request_size_exceeded",
    STORAGE_QUOTA_EXCEEDED = "storage_quota_exceeded",

    // Generic Errors
    CLIENT_ERROR = "client_error",
    SERVER_ERROR = "server_error",
    UNKNOWN_ERROR = "unknown_error",

    ENCODING_ERROR = "encoding_error",

    NOT_FOUND = "not_found",
    INVALID_CSV = "invalid_csv"
}

const messages = {
    [ErrorCode.EMAIL_VERIFICATION_FAILED]: "Email verification failed.",
    [ErrorCode.INVALID_CREDENTIALS]: "Username or password incorrect.",
    [ErrorCode.ACCOUNT_EXISTS]: "This account already exists."
};

const statusCodes = {
    [ErrorCode.BAD_REQUEST]: 400,
    [ErrorCode.EMAIL_VERIFICATION_FAILED]: 400,
    [ErrorCode.INVALID_SESSION]: 401,
    [ErrorCode.SESSION_EXPIRED]: 401,
    [ErrorCode.INVALID_CREDENTIALS]: 401,
    [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
    [ErrorCode.NOT_FOUND]: 404,
    [ErrorCode.DEPRECATED_API_VERSION]: 406,
    [ErrorCode.ACCOUNT_EXISTS]: 409
};

export class Err extends Error {
    code: ErrorCode;
    report: boolean;
    display: boolean;
    status: number;
    originalError?: Error;

    constructor(
        code: ErrorCode,
        message?: string,
        opts: { report?: boolean; display?: boolean; status?: number; error?: Error } = {}
    ) {
        super(message || messages[code] || (opts.error && opts.error.message) || "");
        this.code = code;
        this.status = opts.status || statusCodes[code] || 500;
        this.report = opts.report || false;
        this.display = opts.report || false;
        this.originalError = opts.error;
    }

    toString() {
        return `${this.code}: ${this.message}`;
    }
}

export function errFromRequest(request: XMLHttpRequest): Err {
    try {
        const { error, message } = unmarshal(request.responseText) as { error: ErrorCode; message: string };
        return new Err(error, message, { status: request.status });
    } catch (e) {
        switch (request.status.toString()[0]) {
            case "0":
                return new Err(ErrorCode.FAILED_CONNECTION, request.responseText, { status: request.status });
            case "3":
                return new Err(ErrorCode.UNEXPECTED_REDIRECT, request.responseText, { status: request.status });
            case "4":
                return new Err(ErrorCode.CLIENT_ERROR, request.responseText, { status: request.status });
            default:
                return new Err(ErrorCode.SERVER_ERROR, request.responseText, { status: request.status });
        }
    }
}
