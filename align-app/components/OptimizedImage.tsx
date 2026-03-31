"use client";

import Image from "next/image";

type OptimizedImageProps = {
  src: string;
  alt?: string;
  className?: string;
  /** Pentru layout fill (ex. card full) */
  fill?: boolean;
  /** Pentru dimensiuni fixe – next/image folosește pentru sizes */
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  /** Calitate decodificare next/image (implicit mai mare ca default-ul 75). */
  quality?: number;
};

/** URL-uri care trec prin `next.config` `images.remotePatterns` (ex. Vercel Blob). */
function isOptimizableRemoteUrl(src: string): boolean {
  if (!src.startsWith("https://") && !src.startsWith("http://")) return false;
  try {
    const h = new URL(src).hostname;
    return h.endsWith(".public.blob.vercel-storage.com") || h.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

/**
 * Imagine optimizată: lazy load, fără blur placeholder.
 * - data: → <img> lazy
 * - /… relativ sau Blob permis → next/image (srcset + calitate)
 * - alte URL-uri externe → <img> lazy
 */
export function OptimizedImage({
  src,
  alt = "",
  className = "",
  fill = false,
  width,
  height,
  sizes,
  priority = false,
  quality = 86,
}: OptimizedImageProps) {
  const isDataUrl = src.startsWith("data:");
  const isRelative = src.startsWith("/");
  const useNext = !isDataUrl && (isRelative || isOptimizableRemoteUrl(src));

  if (isDataUrl || !useNext) {
    const imgClass = fill ? `absolute inset-0 w-full h-full ${className}` : className;
    return (
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={imgClass}
      />
    );
  }

  if (fill) {
    const hasObjectFit = /\bobject-(contain|cover|fill|none|scale-down)\b/.test(className);
    const fit = hasObjectFit ? "" : "object-cover ";
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes ?? "100vw"}
        quality={quality}
        className={`${fit}${className}`.trim()}
        loading={priority ? "eager" : "lazy"}
        priority={priority}
      />
    );
  }

  const w = width ?? 96;
  const h = height ?? 96;
  return (
    <Image
      src={src}
      alt={alt}
      width={w}
      height={h}
      sizes={sizes ?? "(max-width: 768px) 96px, 96px"}
      quality={quality}
      className={className}
      loading={priority ? "eager" : "lazy"}
      priority={priority}
    />
  );
}
