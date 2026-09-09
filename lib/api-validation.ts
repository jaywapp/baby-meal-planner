export class InputError extends Error {}

export function requireInput(condition: unknown, message: string): asserts condition {
  if (!condition) throw new InputError(message);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await req.json();
  } catch {
    throw new InputError('Invalid JSON body');
  }
  requireInput(isRecord(value), 'JSON object required');
  return value;
}

export function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isId(value: unknown): boolean {
  return (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value)))
    && Number.isSafeInteger(Number(value)) && Number(value) > 0 && Number(value) <= 2147483647;
}

export function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2147483647;
}

export function withApiErrors<Args extends unknown[]>(
  operation: string,
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof InputError) return Response.json({ error: error.message }, { status: 400 });
      const requestId = crypto.randomUUID();
      console.error('[api] Request failed', { operation, requestId });
      return Response.json({ error: 'Request failed', requestId }, { status: 500 });
    }
  };
}
