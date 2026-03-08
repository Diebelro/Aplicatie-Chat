"use client";

import Image from "next/image";

/** Blur placeholder mic (gri) pentru tranziție la încărcare */
const BLUR_DATA =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjMjIzMDNjIi8+PC9zdmc+";

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
};

/**
 * Imagine optimizată: lazy load, blur la încărcare.
 * - data: → <img> lazy
 * - URL relativ (/) → next/image cu blur
 * - URL extern (http(s)) → <img> lazy (fără config remotePatterns)
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
}: OptimizedImageProps) {
  const isDataUrl = src.startsWith("data:");
  const isSameOrigin = src.startsWith("/");

  if (isDataUrl || !isSameOrigin) {
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
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes ?? "100vw"}
        className={`object-cover ${className}`}
        placeholder="blur"
        blurDataURL={BLUR_DATA}
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
      className={className}
      placeholder="blur"
      blurDataURL={BLUR_DATA}
      loading={priority ? "eager" : "lazy"}
      priority={priority}
    />
  );
}
