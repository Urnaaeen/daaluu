/**
 * Клиент рүү буцаах алдаа. code нь апп талд шалгах түлхүүр,
 * message нь хэрэглэгчид харуулах монгол текст.
 */
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message ?? code);
    this.status = status;
    this.code = code;
    this.userMessage = message;
  }
}

export const badRequest = (code, message) => new ApiError(400, code, message);
export const unauthorized = (code, message) => new ApiError(401, code, message);
export const forbidden = (code, message) => new ApiError(403, code, message);
export const notFound = (code, message) => new ApiError(404, code, message);
export const conflict = (code, message) => new ApiError(409, code, message);

// async route handler-ийн алдааг Express рүү дамжуулна
export const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
