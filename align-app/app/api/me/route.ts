if (body.photos !== undefined) {
  const rawCount = Array.isArray(body.photos) ? body.photos.length : 0;

  const photoUrls: string[] = Array.isArray(body.photos)
    ? body.photos
        .slice(0, 5)
        .filter((p: unknown): p is string => typeof p === "string" && p.trim().length > 0)
        .map((p: string) => p.trim())
    : [];

  if (process.env.NODE_ENV === "development" && rawCount > 0 && photoUrls.length === 0) {
    console.warn(
      "[api/me PATCH] Pozele au fost eliminate la validare (body.photos avea",
      rawCount,
      "elemente). Verifică că sunt string-uri și că nu depășesc ~2MB fiecare."
    );
  }

  await prismaUpsertProfilePhotos(userId, photoUrls);

  if (process.env.NODE_ENV === "development") {
    const profileAfter = await prisma.profile.findUnique({
      where: { userId },
      include: { photos: true },
    });
    console.log(
      "[api/me PATCH] body.photos length:",
      photoUrls.length,
      "| DB profile.photos length:",
      profileAfter?.photos?.length ?? 0
    );
  }
}