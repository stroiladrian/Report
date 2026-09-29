/** Domain error with an HTTP status and a stable machine-readable code. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const Errors = {
  unauthorized: (msg = "Authentication required") => new AppError(401, "UNAUTHORIZED", msg),
  forbidden: (msg = "You do not have permission to perform this action") => new AppError(403, "FORBIDDEN", msg),
  notFound: (what = "Resource") => new AppError(404, "NOT_FOUND", `${what} not found`),
  badRequest: (msg: string, details?: unknown) => new AppError(400, "BAD_REQUEST", msg, details),
  conflict: (msg: string) => new AppError(409, "CONFLICT", msg),
  validation: (msg: string, details?: unknown) => new AppError(422, "VALIDATION_ERROR", msg, details),
  tooMany: (msg = "Too many requests, please try again later") => new AppError(429, "RATE_LIMITED", msg),
  invalidTransition: (msg: string) => new AppError(409, "INVALID_TRANSITION", msg),
};
