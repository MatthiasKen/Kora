import { AppError } from "./errors";

/** Bound bytes while reading, including requests without Content-Length. */
export async function readBody(request: Request, limit = 65536) {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit)
    throw new AppError("This request is too large.", 413);
  if (!request.body)
    throw new AppError("Please include the required details.", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new AppError("This request is too large.", 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("The request could not be read. Please try again.", 400);
  } finally {
    reader.releaseLock();
  }
}
export async function readJson(request: Request) {
  if (
    !/^application\/json(?:;|$)/i.test(
      request.headers.get("content-type") || "",
    )
  )
    throw new AppError("Send these details as JSON.", 415);
  const raw = await readBody(request);
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new AppError("The submitted details are not valid JSON.", 400);
  }
}
