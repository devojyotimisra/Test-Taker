import React, { useState } from "react";
import { ZoomIn, X } from "lucide-react";
import { resolveImageSource } from "../lib/assetService";

interface FormulaRendererProps {
  text: string;
  className?: string;
}

export function FormulaRenderer({
  text,
  className = "",
}: FormulaRendererProps) {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  if (!text) return null;

  const pattern = /\[IMAGE:\s*([^\]]+)\]/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const raw = match[1].trim();
    let src = raw;
    let isBlock = false;

    if (raw.includes("|")) {
      const splitParts = raw.split("|");
      src = splitParts[0].trim();
      const mode = splitParts[1]?.trim().toLowerCase();
      isBlock = mode === "block";
    } else {
      isBlock =
        raw.toLowerCase().endsWith(".jpg") ||
        raw.toLowerCase().endsWith(".jpeg");
    }

    const { primary, fallback } = resolveImageSource(src);

    if (isBlock) {
      parts.push(
        <span
          key={`img-block-${match.index}`}
          className="group relative block my-3 overflow-hidden rounded-xl border border-border bg-card p-2 sm:p-3 shadow-xs text-center"
        >
          <img
            src={primary}
            alt="Question Diagram"
            className="inline-block max-w-full h-auto object-contain mx-auto rounded-lg cursor-zoom-in transition-transform duration-200 hover:scale-[1.01]"
            loading="lazy"
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.dataset.fallbackTried && fallback && fallback !== target.src) {
                target.dataset.fallbackTried = "true";
                target.src = fallback;
              }
            }}
            onClick={() => setZoomedImage(primary)}
          />
          <button
            type="button"
            onClick={() => setZoomedImage(primary)}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-background/80 hover:bg-background border border-border/60 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-xs"
            title="View original full-size image"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </span>,
      );
    } else {
      parts.push(
        <img
          key={`img-inline-${match.index}`}
          src={primary}
          alt="Formula"
          className="inline-block align-middle h-auto max-w-full px-1 mx-0.5 rounded bg-white/85 dark:bg-white/95"
          style={{ verticalAlign: "middle" }}
          loading="lazy"
          onError={(e) => {
            const target = e.currentTarget;
            if (!target.dataset.fallbackTried && fallback && fallback !== target.src) {
              target.dataset.fallbackTried = "true";
              target.src = fallback;
            }
          }}
        />,
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return (
    <>
      <span className={className}>{parts}</span>

      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setZoomedImage(null)}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] bg-card p-2 sm:p-4 rounded-2xl border border-border shadow-2xl overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomedImage(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-background/90 hover:bg-background border border-border text-foreground transition-colors shadow-md"
              title="Close full-size view"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={zoomedImage}
              alt="Full size diagram"
              className="w-auto h-auto max-w-full max-h-[82vh] object-contain rounded-lg mx-auto"
            />
          </div>
        </div>
      )}
    </>
  );
}
