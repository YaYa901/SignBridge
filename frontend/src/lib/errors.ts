export const errorMessage = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : 'حدث خطأ غير متوقع. حاول مرة أخرى.'
