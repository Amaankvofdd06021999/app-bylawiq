/** The `{ error }` message of a failed API response, or `fallback` when the body isn't the JSON our routes send
 * (a platform error page, a body-size limit, a dropped connection). Never throws. */
export async function errorFrom(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string')
      return body.error;
  } catch {
    // Not JSON: fall through to the fallback.
  }
  return fallback;
}
