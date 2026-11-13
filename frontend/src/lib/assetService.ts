import { Paper } from "../types";

const RAW_GITHUB_BASE = "https://raw.githubusercontent.com/devojyotimisra/Test-Taker/main/data";
const JSDELIVR_BASE = "https://cdn.jsdelivr.net/gh/devojyotimisra/Test-Taker@main/data";

export function getDataBaseUrls(): string[] {
  const custom = import.meta.env.VITE_DATA_BASE_URL?.trim()?.replace(/\/+$/, "");
  const list: string[] = [];
  if (custom) list.push(custom);
  if (!list.includes(RAW_GITHUB_BASE)) list.push(RAW_GITHUB_BASE);
  if (!list.includes(JSDELIVR_BASE)) list.push(JSDELIVR_BASE);
  list.push("/data");
  return list;
}

export async function fetchJsonWithFallback<T = unknown>(subPath: string, timeoutMs = 6000): Promise<T> {
  const cleanPath = subPath.replace(/^\/?data\//, "").replace(/^\/+/, "");
  const baseUrls = getDataBaseUrls();
  const errors: string[] = [];

  for (const base of baseUrls) {
    const url = base.startsWith("http") ? `${base}/${cleanPath}` : `${base}/${cleanPath}`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        return (await res.json()) as T;
      }
      errors.push(`${url}: status ${res.status}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${url}: ${msg}`);
    }
  }

  throw new Error(`Failed to load data for ${cleanPath}. (${errors.join("; ")})`);
}

export function resolveImageSource(rawSrc: string): { primary: string; fallback: string } {
  const clean = rawSrc.trim();
  if (clean.startsWith("data:") || clean.startsWith("http://") || clean.startsWith("https://")) {
    return { primary: clean, fallback: clean };
  }

  const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  if (clean.startsWith("/data/") || clean.startsWith("data/")) {
    const sub = clean.replace(/^\/?data\//, "");
    const custom = import.meta.env.VITE_DATA_BASE_URL?.trim()?.replace(/\/+$/, "");
    const primaryBase = custom || RAW_GITHUB_BASE;
    const fallbackBase = primaryBase === RAW_GITHUB_BASE ? JSDELIVR_BASE : RAW_GITHUB_BASE;
    return {
      primary: `${primaryBase}/${sub}`,
      fallback: `${fallbackBase}/${sub}`,
    };
  }

  const filename = clean.split("/").pop() || clean;
  const tempUrl = `${apiBase}/temp/image/${filename}`;
  return { primary: tempUrl, fallback: tempUrl };
}

export function preloadPaperImages(paper: Paper): void {
  if (!paper.questions || paper.questions.length === 0) return;
  const urls = new Set<string>();

  for (const q of paper.questions) {
    if (q.images && Array.isArray(q.images)) {
      for (const img of q.images) {
        if (typeof img === "string" && img.trim()) urls.add(img.trim());
      }
    }
    if (q.text) {
      const regex = /\[IMAGE:\s*([^\]|]+)(?:\|[^\]]*)?\]/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(q.text)) !== null) {
        if (match[1] && match[1].trim()) urls.add(match[1].trim());
      }
    }
  }

  for (const rawUrl of urls) {
    const { primary, fallback } = resolveImageSource(rawUrl);
    const imgObj = new Image();
    imgObj.src = primary;
    imgObj.onerror = () => {
      if (fallback && fallback !== primary) {
        const fbObj = new Image();
        fbObj.src = fallback;
      }
    };
  }
}

