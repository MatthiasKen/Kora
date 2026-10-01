export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof AppError)
    return Response.json(
      {
        error: error.message,
        ...(error.fields ? { fields: error.fields } : {}),
      },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  console.error(
    "Request failed:",
    error instanceof Error ? error.message : "unknown error",
  );
  return Response.json(
    { error: "We couldn't complete that request. Please try again." },
    { status: 503 },
  );
}
export function fieldError(issues: { path: PropertyKey[]; message: string }[]) {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.path.map(String).join(".");
    fields[path] ||= issue.message;
  }
  return new AppError("Please correct the highlighted details.", 422, fields);
}
