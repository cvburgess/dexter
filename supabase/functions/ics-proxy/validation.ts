// URL validation and outbound-request hardening for the ics-proxy function.
//
// The proxy is public (verify_jwt = false), so these checks are the only thing
// standing between an anonymous caller and an SSRF/open-proxy vector. Keep the
// logic pure and exported so it can be unit-tested directly (see
// supabase/__tests__/ics-proxy/validation.test.ts).

export interface TargetError {
  status: number;
  error: string;
}

export type IcsUrlResult =
  | { ok: true; url: URL }
  | ({ ok: false } & TargetError);

// Parses dotted-quad IPv4 literals like "127.0.0.1". Returns the four octets,
// or null when the host is not an IPv4 literal (e.g. a domain name).
function parseIpv4(host: string): [number, number, number, number] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;

  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    octets.push(value);
  }

  return octets as [number, number, number, number];
}

// True when an IPv4 address is loopback, private, link-local (incl. the cloud
// metadata endpoint 169.254.169.254), carrier-grade NAT, or unspecified.
function isBlockedIpv4([a, b]: [number, number, number, number]): boolean {
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  return false;
}

// True when an IPv6 literal is loopback, unspecified, unique-local (fc00::/7),
// or link-local (fe80::/10). Also unwraps IPv4-mapped addresses so an attacker
// cannot smuggle a private IPv4 target through "::ffff:127.0.0.1" — note the URL
// parser normalizes the embedded IPv4 to hex, e.g. "::ffff:7f00:1".
function isBlockedIpv6(host: string): boolean {
  if (host === "::1" || host === "::") return true;

  // IPv4-mapped address as two hex groups: ::ffff:7f00:1 => 127.0.0.1
  const hexMapped = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (hexMapped) {
    const hi = parseInt(hexMapped[1], 16);
    const lo = parseInt(hexMapped[2], 16);
    return isBlockedIpv4([hi >> 8, hi & 0xff, lo >> 8, lo & 0xff]);
  }

  // IPv4-mapped address kept in dotted form: ::ffff:127.0.0.1
  const dotMapped = host.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (dotMapped) {
    const ipv4 = parseIpv4(dotMapped[1]);
    return ipv4 ? isBlockedIpv4(ipv4) : true;
  }

  const prefix = host.slice(0, 4);
  if (prefix.startsWith("fc") || prefix.startsWith("fd")) return true; // fc00::/7
  if (/^fe[89ab]/.test(prefix)) return true; // fe80::/10 link-local
  return false;
}

// Blocks hosts that must never be reachable through the proxy. Bare hostnames
// (domain names) are allowed here — DNS-rebinding is out of scope and would
// require resolving + pinning the address ourselves.
export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (host === "localhost" || host.endsWith(".localhost")) return true;

  if (host.includes(":")) return isBlockedIpv6(host);

  const ipv4 = parseIpv4(host);
  if (ipv4) return isBlockedIpv4(ipv4);

  return false;
}

// Scheme/credential/host checks applied to the initial URL and to every
// redirect hop. Returns null when the target is safe to fetch.
export function checkTargetSafety(url: URL): TargetError | null {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { status: 400, error: "Only http and https URLs are allowed" };
  }

  if (url.username || url.password) {
    return { status: 400, error: "URLs may not contain credentials" };
  }

  if (isBlockedHostname(url.hostname)) {
    return { status: 403, error: "URL host is not allowed" };
  }

  return null;
}

// Validates the caller-supplied feed URL: it must parse, pass the target-safety
// checks, and point at an `.ics` file. The suffix is checked against the parsed
// pathname (not the raw string) so tokenized feeds like
// `https://host/cal.ics?token=abc` are accepted.
export function validateIcsUrl(raw: string): IcsUrlResult {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, status: 400, error: "Invalid URL" };
  }

  const unsafe = checkTargetSafety(url);
  if (unsafe) return { ok: false, ...unsafe };

  if (!url.pathname.toLowerCase().endsWith(".ics")) {
    return { ok: false, status: 403, error: "Only .ics file URLs are allowed" };
  }

  return { ok: true, url };
}

// Explicit outbound header allowlist. Nothing from the inbound request is
// forwarded, so caller credentials (authorization, cookie, apikey, …) can never
// leak to a user-supplied calendar host.
export function buildOutboundHeaders(): Headers {
  return new Headers({
    "Accept": "text/calendar, text/plain;q=0.9, */*;q=0.5",
    "User-Agent": "dexter-ics-proxy",
  });
}
