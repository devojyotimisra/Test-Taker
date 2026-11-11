import React from "react";

interface FormulaRendererProps {
  text: string;
  className?: string;
}

export function FormulaRenderer({
  text,
  className = "",
}: FormulaRendererProps) {
  if (!text) return null;

  const pattern = /\[IMAGE:\s*([^\]]+)\]/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const rawPath = match[1].trim();
    const filename = rawPath.split("/").pop() || rawPath;
    const apiBase = import.meta.env.VITE_API_URL || "";
    const isBlock =
      rawPath.toLowerCase().endsWith(".jpg") ||
      rawPath.toLowerCase().endsWith(".jpeg");
    const src = `${apiBase}/temp/image/${filename}`;

    if (isBlock) {
      parts.push(
        <span
          key={`img-${match.index}`}
          className="block my-2 overflow-hidden rounded-lg border border-border bg-card p-1.5 shadow-xs"
        >
          <img
            src={src}
            alt={filename}
            className="max-h-56 sm:max-h-64 max-w-full object-contain mx-auto rounded"
            loading="lazy"
          />
        </span>,
      );
    } else {
      parts.push(
        <img
          key={`img-${match.index}`}
          src={src}
          alt={filename}
          className="inline-block align-middle max-h-7 max-w-full object-contain px-0.5 mx-0.5 rounded bg-white/70 dark:bg-white/90"
          loading="lazy"
        />,
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <span className={className}>{parts}</span>;
}
