import { Paper } from "../types";

const RAW_GITHUB_BASE = "https://raw.githubusercontent.com/devojyotimisra/Test-Taker/main/data";
const JSDELIVR_BASE = "https://cdn.jsdelivr.net/gh/devojyotimisra/Test-Taker@main/data";

const jsonCache = new Map<string, unknown>();
const imageCache = new Map<string, HTMLImageElement>();

export function getCachedJson<T>(key: string): T | undefined {
  const cleanKey = key.replace(/^\/?data\//, "").replace(/^\/+/, "");
  return jsonCache.get(cleanKey) as T | undefined;
}

export function setCachedJson<T>(key: string, data: T): void {
  const cleanKey = key.replace(/^\/?data\//, "").replace(/^\/+/, "");
  jsonCache.set(cleanKey, data);
}

export function getDataBaseUrls(): string[] {
  const custom = import.meta.env.VITE_DATA_BASE_URL?.trim()?.replace(/\/+$/, "");
  const list: string[] = [];

  if (import.meta.env.DEV) {
    list.push("/data");
  }

  if (custom && !list.includes(custom)) {
    list.push(custom);
  }

  if (!list.includes(RAW_GITHUB_BASE)) {
    list.push(RAW_GITHUB_BASE);
  }

  if (!list.includes(JSDELIVR_BASE)) {
    list.push(JSDELIVR_BASE);
  }

  if (!list.includes("/data")) {
    list.push("/data");
  }

  return list;
}

export async function fetchJsonWithFallback<T = unknown>(subPath: string, timeoutMs = 8000): Promise<T> {
  const cleanPath = subPath.replace(/^\/?data\//, "").replace(/^\/+/, "");

  if (jsonCache.has(cleanPath)) {
    return jsonCache.get(cleanPath) as T;
  }

  const pathsToTry = [cleanPath];
  if (!cleanPath.startsWith("papers/") && cleanPath.endsWith(".json") && cleanPath !== "catalog.json" && cleanPath !== "courses.json") {
    pathsToTry.push(`papers/${cleanPath}`);
  }

  const baseUrls = getDataBaseUrls();
  const errors: string[] = [];

  for (const path of pathsToTry) {
    if (jsonCache.has(path)) {
      return jsonCache.get(path) as T;
    }
    for (const base of baseUrls) {
      const url = `${base}/${path}`;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("text/html")) {
            errors.push(`${url}: received html instead of json`);
            continue;
          }
          const text = await res.text();
          if (text.trim().startsWith("<")) {
            errors.push(`${url}: received html doctype instead of json`);
            continue;
          }
          const data = JSON.parse(text) as T;
          jsonCache.set(cleanPath, data);
          jsonCache.set(path, data);
          return data;
        }
        errors.push(`${url}: status ${res.status}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${url}: ${msg}`);
      }
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

    if (import.meta.env.DEV) {
      return {
        primary: `/data/${sub}`,
        fallback: `${RAW_GITHUB_BASE}/${sub}`,
      };
    }

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

export function extractAllPaperImageUrls(paper: Paper): string[] {
  if (!paper.questions || paper.questions.length === 0) return [];

  const urls = new Set<string>();
  const tagRegex = /\[IMAGE:\s*([^\]|]+)(?:\|[^\]]*)?\]/g;

  const scanText = (text?: string | null) => {
    if (!text) return;
    let match: RegExpExecArray | null;
    tagRegex.lastIndex = 0;
    while ((match = tagRegex.exec(text)) !== null) {
      if (match[1] && match[1].trim()) {
        urls.add(match[1].trim());
      }
    }
  };

  for (const q of paper.questions) {
    if (q.images && Array.isArray(q.images)) {
      for (const img of q.images) {
        if (typeof img === "string" && img.trim()) {
          urls.add(img.trim());
        }
      }
    }

    scanText(q.text);
    scanText(q.comprehension_passage);

    if (q.options && Array.isArray(q.options)) {
      for (const opt of q.options) {
        scanText(opt);
      }
    }
  }

  return Array.from(urls);
}

export function preloadPaperImages(paper: Paper): void {
  const urls = extractAllPaperImageUrls(paper);
  for (const rawUrl of urls) {
    const { primary, fallback } = resolveImageSource(rawUrl);
    if (imageCache.has(primary)) continue;

    const imgObj = new Image();
    imgObj.src = primary;
    imgObj.onload = () => {
      imageCache.set(primary, imgObj);
    };
    imgObj.onerror = () => {
      if (fallback && fallback !== primary) {
        const fbObj = new Image();
        fbObj.src = fallback;
        fbObj.onload = () => {
          imageCache.set(fallback, fbObj);
        };
      }
    };
  }
}

export function preloadPaperAssets(
  paper: Paper,
  onProgress?: (loaded: number, total: number) => void
): Promise<void> {
  const urls = extractAllPaperImageUrls(paper);
  const total = urls.length;

  if (total === 0) {
    if (onProgress) onProgress(0, 0);
    return Promise.resolve();
  }

  let loadedCount = 0;

  const promises = urls.map((rawUrl) => {
    return new Promise<void>((resolve) => {
      const { primary, fallback } = resolveImageSource(rawUrl);

      if (imageCache.has(primary) || (fallback && imageCache.has(fallback))) {
        loadedCount++;
        if (onProgress) onProgress(loadedCount, total);
        resolve();
        return;
      }

      const img = new Image();
      let resolved = false;

      const finish = (finalSrc: string, el: HTMLImageElement) => {
        if (!resolved) {
          resolved = true;
          imageCache.set(finalSrc, el);
          loadedCount++;
          if (onProgress) onProgress(loadedCount, total);
          resolve();
        }
      };

      img.onload = () => finish(primary, img);
      img.onerror = () => {
        if (fallback && fallback !== primary) {
          const fbImg = new Image();
          fbImg.onload = () => finish(fallback, fbImg);
          fbImg.onerror = () => finish(primary, img);
          fbImg.src = fallback;
        } else {
          finish(primary, img);
        }
      };

      img.src = primary;
    });
  });

  return new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      resolve();
    }, 8000);

    Promise.allSettled(promises).then(() => {
      clearTimeout(timeout);
      resolve();
    });
  });
}
