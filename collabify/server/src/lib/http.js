export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg, details) => new HttpError(400, msg, details);
export const unauthorized = (msg = 'Please sign in') => new HttpError(401, msg);
export const forbidden = (msg = 'You do not have access to this') => new HttpError(403, msg);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);
export const conflict = (msg) => new HttpError(409, msg);

/** Validate req[part] against a zod schema, returning the parsed value. */
export function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    throw badRequest(details[0] ? `${details[0].path || 'input'}: ${details[0].message}` : 'Invalid input', details);
  }
  return result.data;
}

export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
}
