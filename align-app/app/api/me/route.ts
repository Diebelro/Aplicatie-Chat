import { NextRequest, NextResponse } from "next/server";
import { findUserById, setUserActive, setUserPosition, updateUser, isUsernameTaken, type Gender } from "@/lib/store";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import {
  isPrismaAvailable,
  findUserOrPrisma,
  prismaFindUserByIdForMe,
  prismaUpdateProfile,
  prismaUpsertProfilePhotos,
  prismaSetProfileCompleted,
  prismaProfileCompleted,
  prismaFindUserByUsername,
  prismaUpdateLastActive,
} from "@/lib/repo-prisma";

const VALID_GENDERS: Gender[] = ["male", "female", "other"];

export async function GET(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  setUserActive(userId);
  if (isPrismaAvailable()) {
    try {
      const user = await prismaFindUserByIdForMe(userId);
      if (user) {
        await prismaUpdateLastActive(userId);
        return NextResponse.json({ user });
      }
    } catch {
      return NextResponse.json({ error: "Eroare server." }, { status: 500 });
    }
  }
  const user = findUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  return NextResponse.json({ user });
}

/** Actualizează poziția utilizatorului (lat/lng din geolocation). */
export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  if (isPrismaAvailable()) {
    try {
      const me = await findUserOrPrisma(userId);
      if (me) {
        const body = await request.json().catch(() => ({}));
        const lat = Number(body.latitude ?? body.lat);
        const lng = Number(body.longitude ?? body.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return NextResponse.json(
            { error: "Lipsesc latitude sau longitude." },
            { status: 400 }
          );
        }
        const { prismaUpsertLocation } = await import("@/lib/repo-prisma");
        await prismaUpsertLocation(userId, lat, lng);
        return NextResponse.json({ ok: true });
      }
    } catch {
      return NextResponse.json({ error: "Eroare server." }, { status: 500 });
    }
  }
  if (!findUserById(userId)) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  const lat = Number(body.latitude ?? body.lat);
  const lng = Number(body.longitude ?? body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "Lipsesc latitude sau longitude." },
      { status: 400 }
    );
  }
  setUserPosition(userId, lat, lng);
  return NextResponse.json({ ok: true });
}

/** Actualizează profilul (nume, bio, vârstă, gen, oraș). */
export async function PATCH(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));

  const nameVal = body.name != null ? String(body.name).trim() : "";
  const nameValid = nameVal.length >= 3 && /^\p{L}+$/u.test(nameVal);

  if (body.username != null) {
    const raw = String(body.username).trim().toLowerCase();
    if (raw.length < 2 || raw.length > 30) {
      return NextResponse.json({ error: "Username-ul trebuie să aibă între 2 și 30 de caractere." }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_.]+$/.test(raw)) {
      return NextResponse.json({ error: "Username-ul poate conține doar litere, cifre, punct și underscore." }, { status: 400 });
    }
    if (isPrismaAvailable()) {
      const existing = await prismaFindUserByUsername(raw);
      if (existing && existing.id !== userId) {
        return NextResponse.json({ error: "Acest username este deja folosit." }, { status: 400 });
      }
    } else if (isUsernameTaken(raw, userId)) {
      return NextResponse.json({ error: "Acest username este deja folosit." }, { status: 400 });
    }
  }
  if (body.email != null) {
    const emailStr = String(body.email).trim().toLowerCase();
    if (!emailStr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
      return NextResponse.json({ error: "Introdu un email valid." }, { status: 400 });
    }
  }

  if (isPrismaAvailable()) {
    try {
      const me = await findUserOrPrisma(userId);
      if (!me) {
        return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
      }
      const profileData: Parameters<typeof prismaUpdateProfile>[1] = {};
      if (body.real_name !== undefined) profileData.realName = body.real_name === "" ? null : String(body.real_name).trim();
      if (body.username != null) {
        const raw = String(body.username).trim().toLowerCase();
        profileData.username = raw;
        profileData.name = raw;
      }
      if (body.name != null && nameValid) profileData.name = String(body.name).trim();
      if (body.bio != null) profileData.bio = String(body.bio).trim();
      if (body.country != null) profileData.country = body.country === "" ? null : String(body.country).trim();
      if (body.city != null) profileData.city = body.city === "" ? undefined : String(body.city).trim();
      if (body.postalCode != null) profileData.postalCode = body.postalCode === "" ? undefined : String(body.postalCode).trim();
      if (body.birthDate != null) profileData.birthDate = body.birthDate === "" ? undefined : String(body.birthDate).trim();
      if (body.educationLevel != null) profileData.educationLevel = body.educationLevel === "" ? undefined : String(body.educationLevel).trim();
      if (body.occupation != null) profileData.occupation = body.occupation === "" ? undefined : String(body.occupation).trim();
      if (body.maritalStatus != null) profileData.maritalStatus = body.maritalStatus === "" ? undefined : String(body.maritalStatus).trim();
      if (body.wantsChildren != null) profileData.wantsChildren = body.wantsChildren === "" ? undefined : String(body.wantsChildren).trim();
      if (body.gender != null) {
        profileData.gender = body.gender === "" || !VALID_GENDERS.includes(body.gender) ? undefined : body.gender;
      }
      if (body.height != null) {
        const h = Number(body.height);
        if (Number.isFinite(h) && h >= 100 && h <= 250) profileData.height = h;
      }
      if (body.weight != null) {
        const w = Number(body.weight);
        if (Number.isFinite(w) && w >= 30 && w <= 250) profileData.weight = w;
      }
      if (body.eyeColor != null) profileData.eyeColor = body.eyeColor === "" ? undefined : String(body.eyeColor).trim();
      if (body.hairColor != null) profileData.hairColor = body.hairColor === "" ? undefined : String(body.hairColor).trim();
      if (body.bodyType != null) profileData.bodyType = body.bodyType === "" ? undefined : String(body.bodyType).trim();
      if (body.clothingStyle != null) profileData.clothingStyle = body.clothingStyle === "" ? undefined : String(body.clothingStyle).trim();
      if (body.distinctiveFeatures != null) profileData.distinctiveFeatures = body.distinctiveFeatures === "" ? undefined : String(body.distinctiveFeatures).trim();
      if (body.physical_asset != null) profileData.physicalAsset = body.physical_asset === "" ? undefined : String(body.physical_asset).trim();
      if (body.physical_asset_detail != null) profileData.physicalAssetDetail = body.physical_asset_detail === "" ? undefined : String(body.physical_asset_detail).trim().slice(0, 40);
      if (body.partnerPhysicalPreferences != null) profileData.partnerPhysicalPreferences = body.partnerPhysicalPreferences === "" ? undefined : String(body.partnerPhysicalPreferences).trim();
      if (body.partnerLifestyle != null) profileData.partnerLifestyle = body.partnerLifestyle === "" ? undefined : String(body.partnerLifestyle).trim();
      if (body.partnerDealBreakers != null) profileData.partnerDealBreakers = body.partnerDealBreakers === "" ? undefined : String(body.partnerDealBreakers).trim();
      if (body.show_distance !== undefined) profileData.showDistance = !!body.show_distance;
      if (body.show_online !== undefined) profileData.showOnline = !!body.show_online;
      if (body.show_profile_visits !== undefined) profileData.showProfileVisits = !!body.show_profile_visits;
      if (body.show_read_receipts !== undefined) profileData.showReadReceipts = !!body.show_read_receipts;
      if (body.allow_friend_requests !== undefined) profileData.allowFriendRequests = !!body.allow_friend_requests;

      if (body.email != null) {
        const { prismaUpdateUserEmail } = await import("@/lib/repo-prisma");
        await prismaUpdateUserEmail(userId, String(body.email).trim().toLowerCase());
      }
      if (Object.keys(profileData).length > 0) await prismaUpdateProfile(userId, profileData);
      if (body.photos !== undefined) {
        const rawCount = Array.isArray(body.photos) ? body.photos.length : 0;
        const photoUrls: string[] = Array.isArray(body.photos)
          ? body.photos
              .slice(0, 5)
              .filter((p: unknown) => typeof p === "string" && String(p).trim().length > 0)
              .map((p) => String(p).trim())
          : [];
        if (process.env.NODE_ENV === "development" && rawCount > 0 && photoUrls.length === 0) {
          console.warn("[api/me PATCH] Pozele au fost eliminate la validare (body.photos avea", rawCount, "elemente). Verifică că sunt string-uri și că nu depășesc ~2MB fiecare.");
        }
        await prismaUpsertProfilePhotos(userId, photoUrls);
        if (process.env.NODE_ENV === "development") {
          const { prisma } = await import("@/lib/db");
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

      const { prisma } = await import("@/lib/db");
      let profile = await prisma.profile.findUnique({ where: { userId }, include: { photos: true } });
      if (profile && !profile.username?.trim()) {
        const base = (profile.name?.trim() || "user").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20) || "user";
        let candidate = base;
        let found = false;
        for (let i = 0; i < 10; i++) {
          candidate = i === 0 ? base : `${base}_${i}`;
          if (candidate.length < 2) continue;
          const existing = await prismaFindUserByUsername(candidate);
          if (!existing || existing.id === userId) {
            await prisma.profile.update({ where: { userId }, data: { username: candidate } });
            profile = await prisma.profile.findUnique({ where: { userId }, include: { photos: true } });
            found = true;
            break;
          }
        }
        if (!found) {
          return NextResponse.json(
            { error: "Nu s-a putut genera un username unic. Completează Prenumele cu o valoare mai unică și salvează din nou." },
            { status: 400 }
          );
        }
      }
      const hadCompleted = await prismaProfileCompleted(userId);
      const nameOk = !!(profile?.name?.trim());
      const genderOk = !!(profile?.gender?.trim());
      const nowComplete = nameOk && genderOk;
      if (nowComplete && !hadCompleted) await prismaSetProfileCompleted(userId);

      const user = (await prismaFindUserByIdForMe(userId)) ?? (await findUserOrPrisma(userId)) ?? me;
      return NextResponse.json({ user });
    } catch (err) {
      console.error("[api/me PATCH]", err);
      return NextResponse.json(
        { error: "Eroare la salvare. Încearcă poze mai mici sau mai puține." },
        { status: 500 }
      );
    }
  }

  if (!findUserById(userId)) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  const updates: Record<string, unknown> = {};
  if (body.real_name !== undefined) updates.real_name = body.real_name === "" ? null : String(body.real_name).trim();
  if (body.username != null) {
    const raw = String(body.username).trim().toLowerCase();
    updates.username = raw;
    updates.name = raw;
  }
  if (body.email != null) updates.email = String(body.email).trim().toLowerCase();
  if (body.name != null) updates.name = String(body.name).trim();
  if (body.bio != null) updates.bio = String(body.bio).trim();
  if (body.country != null) updates.country = body.country === "" ? null : String(body.country).trim();
  if (body.city != null) updates.city = body.city === "" ? undefined : String(body.city).trim();
  if (body.postalCode != null) updates.postalCode = body.postalCode === "" ? undefined : String(body.postalCode).trim();
  if (body.birthDate != null) updates.birthDate = body.birthDate === "" ? undefined : String(body.birthDate).trim();
  if (body.educationLevel != null) updates.educationLevel = body.educationLevel === "" ? undefined : String(body.educationLevel).trim();
  if (body.occupation != null) updates.occupation = body.occupation === "" ? undefined : String(body.occupation).trim();
  if (body.maritalStatus != null) updates.maritalStatus = body.maritalStatus === "" ? undefined : String(body.maritalStatus).trim();
  if (body.wantsChildren != null) updates.wantsChildren = body.wantsChildren === "" ? undefined : String(body.wantsChildren).trim();
  if (body.age != null) {
    const a = Number(body.age);
    if (Number.isFinite(a) && a >= 18 && a <= 120) updates.age = a;
  }
  if (body.gender != null) {
    updates.gender = body.gender === "" || !VALID_GENDERS.includes(body.gender) ? undefined : body.gender as Gender;
  }
  if (body.height != null) {
    const h = Number(body.height);
    if (Number.isFinite(h) && h >= 100 && h <= 250) updates.height = h;
  }
  if (body.weight != null) {
    const w = Number(body.weight);
    if (Number.isFinite(w) && w >= 30 && w <= 250) updates.weight = w;
  }
  if (body.eyeColor != null) updates.eyeColor = body.eyeColor === "" ? undefined : String(body.eyeColor).trim();
  if (body.hairColor != null) updates.hairColor = body.hairColor === "" ? undefined : String(body.hairColor).trim();
  if (body.bodyType != null) updates.bodyType = body.bodyType === "" ? undefined : String(body.bodyType).trim();
  if (body.clothingStyle != null) updates.clothingStyle = body.clothingStyle === "" ? undefined : String(body.clothingStyle).trim();
  if (body.distinctiveFeatures != null) updates.distinctiveFeatures = body.distinctiveFeatures === "" ? undefined : String(body.distinctiveFeatures).trim();
  if (body.physical_asset != null) updates.physicalAsset = body.physical_asset === "" ? undefined : String(body.physical_asset).trim();
  if (body.physical_asset_detail != null) updates.physicalAssetDetail = body.physical_asset_detail === "" ? undefined : String(body.physical_asset_detail).trim().slice(0, 40);
  if (body.partnerPhysicalPreferences != null) updates.partnerPhysicalPreferences = body.partnerPhysicalPreferences === "" ? undefined : String(body.partnerPhysicalPreferences).trim();
  if (body.partnerLifestyle != null) updates.partnerLifestyle = body.partnerLifestyle === "" ? undefined : String(body.partnerLifestyle).trim();
  if (body.partnerDealBreakers != null) updates.partnerDealBreakers = body.partnerDealBreakers === "" ? undefined : String(body.partnerDealBreakers).trim();
  if (body.photos !== undefined) {
    updates.photos = Array.isArray(body.photos)
      ? body.photos.slice(0, 5).filter((p: unknown) => typeof p === "string" && p.length > 0)
      : [];
  }
  const user = updateUser(userId, updates as Parameters<typeof updateUser>[1]);
  return NextResponse.json({ user });
}
