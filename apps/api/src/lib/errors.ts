export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function formatZodErrors(error: { issues: { path: (string | number)[]; message: string }[] }) {
  return error.issues.map((i) => ({
    field: i.path.join('.') || 'body',
    message: i.message,
  }));
}
