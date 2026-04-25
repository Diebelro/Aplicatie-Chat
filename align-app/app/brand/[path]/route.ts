import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const BRAND_DIR = path.join(process.cwd(), "public", "brand");

function contentType(filename: string): string {
  if (filename.endsWith(".svg")) return "image/svg+xml; charset=utf-8";
  if (filename.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

/** Pre-render every file in `public/brand` so `/brand/*` is served even if the static layer is skipped. */
export async function generateStaticParams(): Promise<{ path: string }[]> {
  try {
    const names = await readdir(BRAND_DIR);
    return names
      .filter((n) => /^[a-zA-Z0-9._-]+\.(svg|png)$/i.test(n))
      .map((pathSeg) => ({ path: pathSeg }));
  } catch {
    return [];
  }
}

export async function GET(_request: Request, segmentData: { params: Promise<{ path: string }> }) {
  const { path: filename } = await segmentData.params;
  if (!/^[a-zA-Z0-9._-]+\.(svg|png)$/i.test(filename) || filename !== path.basename(filename)) {
    return new NextResponse("Not Found", { status: 404 });
  }
  const fp = path.join(BRAND_DIR, filename);
  try {
    const body = await readFile(fp);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType(filename),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }
}
