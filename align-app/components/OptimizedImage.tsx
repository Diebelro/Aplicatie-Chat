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
};

/**
 * Imagine optimizată: lazy load, fără blur.
 * - data: → <img> lazy
 * - URL relativ (/) → next/image
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
      loading={priority ? "eager" : "lazy"}
      priority={priority}
    />
  );
}
