export type CallApiErrorJson = {
  errorCode: string;
  error?: string;
  message?: string;
};

export function callApiErrorJson(
  errorCode: string,
  opts?: { error?: string; message?: string }
): CallApiErrorJson {
  const body: CallApiErrorJson = { errorCode };
  if (opts?.error != null) body.error = opts.error;
  if (opts?.message != null && process.env.NODE_ENV === "development") body.message = opts.message;
  return body;
}
