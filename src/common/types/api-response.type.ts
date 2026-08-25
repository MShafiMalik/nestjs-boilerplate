export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
  timestamp: string;
  requestId: string;
};

export type ApiErrorBody = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiErrorResponse = {
  success: false;
  error: ApiErrorBody;
  timestamp: string;
  requestId: string;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
