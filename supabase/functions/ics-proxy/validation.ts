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

// Expands an IPv6 literal into its eight 16-bit hextets, resolving "::" zero
// compression and any trailing embedded IPv4 (e.g. "::ffff:127.0.0.1"). Returns
// null when the string is not a valid IPv6 literal. Working on the fully
// expanded form makes range checks representation-independent — a compressed
// literal cannot hide the leading hextet.
function expandIpv6(input: string): number[] | null {
  let str = input;

  // Split off an embedded IPv4 tail; it occupies the final two hextets.
  let ipv4Tail: number[] | null = null;
  if (str.includes(".")) {
    const lastColon = str.lastIndexOf(":");
    if (lastColon === -1) return null;
    const ipv4 = parseIpv4(str.slice(lastColon + 1));
    if (!ipv4) return null;
    ipv4Tail = [(ipv4[0] << 8) | ipv4[1], (ipv4[2] << 8) | ipv4[3]];
    str = str.slice(0, lastColon);
  }

  const parseGroups = (segment: string): number[] | null => {
    if (segment === "") return [];
    const groups: number[] = [];
    for (const group of segment.split(":")) {
      if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
      groups.push(parseInt(group, 16));
    }
    return groups;
  };

  const halves = str.split("::");
  if (halves.length > 2) return null;

  let groups: number[];
  if (halves.length === 2) {
    const head = parseGroups(halves[0]);
    const tail = parseGroups(halves[1]);
    if (head === null || tail === null) return null;
    const explicit = head.length + tail.length + (ipv4Tail ? 2 : 0);
    if (explicit > 7) return null; // "::" must stand in for at least one hextet
    const zeros = new Array(8 - explicit).fill(0);
    groups = [...head, ...zeros, ...tail, ...(ipv4Tail ?? [])];
  } else {
    const head = parseGroups(halves[0]);
    if (head === null) return null;
    groups = [...head, ...(ipv4Tail ?? [])];
  }

  return groups.length === 8 ? groups : null;
}

// True when an IPv6 literal is loopback, unspecified, unique-local (fc00::/7),
// or link-local (fe80::/10), or an IPv4-mapped address (::ffff:a.b.c.d) whose
// embedded IPv4 is itself blocked. Unparseable literals are blocked defensively.
function isBlockedIpv6(host: string): boolean {
  const groups = expandIpv6(host);
  if (!groups) return true;

  if (groups.every((g) => g === 0)) return true; // :: unspecified
  if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) return true; // ::1 loopback

  const first = groups[0];
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local

  // IPv4-mapped address ::ffff:a.b.c.d — check the embedded IPv4.
  const isIpv4Mapped = groups.slice(0, 5).every((g) => g === 0) &&
    groups[5] === 0xffff;
  if (isIpv4Mapped) {
    const [hi, lo] = [groups[6], groups[7]];
    return isBlockedIpv4([hi >> 8, hi & 0xff, lo >> 8, lo & 0xff]);
  }

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
