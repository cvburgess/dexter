const ALLOWED_HOSTS: readonly string[] = [
  "claude.ai",
  "anthropic.com",
  "cursor.sh",
  "cursor.com",
  "chatgpt.com",
  "chat.openai.com",
  "platform.openai.com",
  "gemini.google.com",
  "aistudio.google.com",
  "dexterplanner.com",
  "app.dexterplanner.com",
  "localhost",
  "127.0.0.1",
  "::1",
];

const SUFFIX_MATCH_HOSTS: readonly string[] = [
  "claude.ai",
  "anthropic.com",
  "cursor.sh",
  "cursor.com",
];

export function isOriginAllowed(origin: string | null | undefined): boolean {
  if (!origin) return true;

  let hostname: string;
  try {
    hostname = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }

  if (ALLOWED_HOSTS.includes(hostname)) return true;

  return SUFFIX_MATCH_HOSTS.some((allowed) => hostname.endsWith(`.${allowed}`));
}
