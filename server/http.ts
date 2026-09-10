export type ApiRequest = {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
};

export type ApiResponse = {
  status(code: number): ApiResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string | string[]): void;
  end(body?: string): void;
};

export function json(res: ApiResponse, status: number, body: unknown) {
  res.status(status).json(body);
}

export function parseCookies(req: ApiRequest): Record<string, string> {
  const raw = req.headers.cookie;
  const header = Array.isArray(raw) ? raw.join(";") : raw ?? "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

export function setCookie(
  res: ApiResponse,
  name: string,
  value: string,
  options: { maxAge?: number; httpOnly?: boolean } = {},
) {
  const parts = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    "Path=/",
    "SameSite=Strict",
    "Secure",
  ];
  if (options.httpOnly !== false) parts.push("HttpOnly");
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function clearCookie(res: ApiResponse, name: string) {
  setCookie(res, name, "", { maxAge: 0 });
}