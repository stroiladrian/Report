/** Small fetch wrapper for client components – parses the API error envelope. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] },
  ) {
    super(message);
  }
}

type Opts = { method?: string; json?: unknown; form?: FormData; signal?: AbortSignal };

export async function api<T = unknown>(url: string, opts: Opts = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? (opts.json !== undefined || opts.form ? "POST" : "GET"),
      headers: opts.json !== undefined ? { "content-type": "application/json" } : undefined,
      body: opts.form ?? (opts.json !== undefined ? JSON.stringify(opts.json) : undefined),
      credentials: "same-origin",
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, "NETWORK", "Network error");
  }
  const text = await res.text();
  const body = text ? safeJson(text) : null;
  if (!res.ok) {
    const err = (body as { error?: { code: string; message: string; details?: ApiError["details"] } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? "INTERNAL_ERROR", err?.message ?? res.statusText, err?.details);
  }
  return body as T;
}

function safeJson(t: string) {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

/** Upload with progress (fetch has no upload progress) – used by the report wizard. */
export function uploadWithProgress<T>(url: string, form: FormData, onProgress: (pct: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onerror = () => reject(new ApiError(0, "NETWORK", "Network error"));
    xhr.onload = () => {
      const body = safeJson(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as T);
      else {
        const err = body?.error;
        reject(new ApiError(xhr.status, err?.code ?? "INTERNAL_ERROR", err?.message ?? "Error", err?.details));
      }
    };
    xhr.send(form);
  });
}
