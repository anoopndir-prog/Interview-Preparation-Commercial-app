export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'error',
  ) {
    super(message);
  }
}

export const badRequest = (msg: string) => new HttpError(400, msg, 'bad_request');
export const notFound = (what = 'Resource') => new HttpError(404, `${what} not found`, 'not_found');
export const limitReached = (msg: string) => new HttpError(402, msg, 'plan_limit');
