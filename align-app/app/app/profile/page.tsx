"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { fetchWithAuthRetry, getAuthHeaders } from "@/lib/authClient";
import { useI18n } from "@/lib/i18n/context";
import { formatTpl } from "@/lib/i18n/formatTpl";
import { translateApiErrorMessage } from "@/lib/i18n/translateApiError";
import { MAX_PHOTOS, resizeImageAsDataUrl } from "@/lib/profilePhotoUtils";
import { ProfilePhotosGallery } from "@/components/profile/ProfilePhotosGallery";

function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = getStoredUserRaw();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

const EYE_OPTIONS = ["", "căprui", "albaștri", "verzi", "gri", "albi", "aluni"];
const HAIR_OPTIONS = ["", "negru", "brunet", "blond", "roșu", "cenusu", "vopsit"];
const BODY_TYPE_OPTIONS = ["", "subțire", "sportiv", "mediu", "robust", "musculos", "zvelt"];
const EDUCATION_OPTIONS = ["", "liceu", "post-liceu", "licență", "master", "doctorat", "altul"];
const MARITAL_OPTIONS = ["", "necăsătorit(ă)", "divorțat(ă)", "văduv(ă)", "separat(ă)"];
const WANTS_CHILDREN_OPTIONS = ["", "da", "nu", "poate", "deja am"];
const CLOTHING_STYLE_OPTIONS = ["", "casual", "elegant", "sport", "boem", "clasic", "modern", "minimalist"];
const PHYSICAL_ASSET_FEMALE = ["", "Ochi", "Zâmbet", "Păr", "Siluetă", "Talie", "Picioare", "Postură", "Umeri", "Spate", "Energie / prezență fizică"];
const PHYSICAL_ASSET_MALE = ["", "Umeri", "Spate", "Brațe", "Piept", "Postură", "Înălțime", "Siluetă", "Maxilar / trăsături faciale", "Ochi", "Energie / prezență fizică"];

type ProfileOptGroup = "eye" | "hair" | "bodyType" | "education" | "marital" | "wantsChildren" | "clothing" | "physicalFemale" | "physicalMale";

function trOpt(tStr: (path: string) => string, group: ProfileOptGroup, value: string): string {
  if (!value) return "";
  const s = tStr(`pages.profile.opt.${group}.${value}`);
  return s || value;
}

const inputClass = "w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-zinc-900 placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500";
const labelClass = "block ui-form-label text-sm mb-1";

function parseBirthDate(s: string): { day: string; month: string; year: string } {
  if (!s || s.length < 10) return { day: "", month: "", year: "" };
  const [y, m, d] = s.split("-");
  const dayNum = d ? parseInt(d, 10) : NaN;
  const monthNum = m ? parseInt(m, 10) : NaN;
  return {
    day: Number.isFinite(dayNum) ? String(dayNum) : "",
    month: Number.isFinite(monthNum) ? String(monthNum).padStart(2, "0") : "",
    year: y ?? "",
  };
}
function buildBirthDate(day: string, month: string, year: string): string {
  const y = parseInt(year, 10);
  if (!year.trim() || !Number.isFinite(y)) return "";
  const m = Math.min(12, Math.max(1, parseInt(month, 10) || 1));
  const d = Math.min(31, Math.max(1, parseInt(day, 10) || 1));
  const lastDay = new Date(y, m, 0).getDate();
  const clampedDay = Math.min(d, lastDay);
  return `${y}-${String(m).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}
function computeAgeFromBirthDate(birthDateStr: string): number | null {
  if (!birthDateStr || birthDateStr.length < 10) return null;
  const birth = new Date(birthDateStr);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 && age <= 120 ? age : null;
}

function PrivacySettingsSection() {
  const { tStr } = useI18n();
  const [allowFriendRequests, setAllowFriendRequests] = useState(true);
  const [allowVisitVisibility, setAllowVisitVisibility] = useState(true);
  const [allowReadReceipts, setAllowReadReceipts] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/me/settings", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) {
          setAllowFriendRequests(d.settings.allowFriendRequests ?? true);
          setAllowVisitVisibility(d.settings.allowVisitVisibility ?? true);
          setAllowReadReceipts(d.settings.allowReadReceipts ?? true);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const update = (key: string, value: boolean) => {
    fetch("/api/me/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ [key]: value }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) {
          setAllowFriendRequests(d.settings.allowFriendRequests ?? true);
          setAllowVisitVisibility(d.settings.allowVisitVisibility ?? true);
          setAllowReadReceipts(d.settings.allowReadReceipts ?? true);
        }
      });
  };

  if (loading) return <p className="text-dark-500 text-sm">{tStr("pages.profile.privacyLoading")}</p>;

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={allowFriendRequests}
          onChange={(e) => update("allowFriendRequests", e.target.checked)}
          className="rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-brand-500"
        />
        <span className="text-sm text-gray-300">{tStr("pages.profile.friendReq")}</span>
      </label>
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={allowVisitVisibility}
          onChange={(e) => update("allowVisitVisibility", e.target.checked)}
          className="rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-brand-500"
        />
        <span className="text-sm text-gray-300">{tStr("pages.profile.visitVis")}</span>
      </label>
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={allowReadReceipts}
          onChange={(e) => update("allowReadReceipts", e.target.checked)}
          className="rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-brand-500"
        />
        <span className="text-sm text-gray-300">{tStr("pages.profile.readRcpt")}</span>
      </label>
    </div>
  );
}

export default function ProfilePage() {
  const { tStr } = useI18n();
  const monthLabels = useMemo(
    () => ["", ...Array.from({ length: 12 }, (_, i) => tStr(`common.months.${i + 1}`))],
    [tStr]
  );
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [occupation, setOccupation] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [wantsChildren, setWantsChildren] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [bodyType, setBodyType] = useState("");
  const [eyeColor, setEyeColor] = useState("");
  const [hairColor, setHairColor] = useState("");
  const [clothingStyle, setClothingStyle] = useState("");
  const [distinctiveFeatures, setDistinctiveFeatures] = useState("");
  const [physicalAsset, setPhysicalAsset] = useState("");
  const [physicalAssetDetail, setPhysicalAssetDetail] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<"saved" | "error" | "not_on_server" | null>(null);
  const [errorDetail, setErrorDetail] = useState<string>("");
  const [serverHasUser, setServerHasUser] = useState(true);
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasUnsavedChanges = useRef(false);
  const initialFormDone = useRef(false);
  /** După ce /api/me înlocuiește formularul, nu porni autosave (evită PATCH în cursă cu sesiunea proaspătă de la login). */
  const skipAutosaveAfterServerHydrateRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fillForm = (u: User) => {
    setName(u.name ?? "");
    setBio(u.bio ?? "");
    setBirthDate(u.birthDate ?? "");
    setGender(u.gender ?? "");
    setCity(u.city ?? "");
    setPostalCode(u.postalCode ?? "");
    setEducationLevel(u.educationLevel ?? "");
    setOccupation(u.occupation ?? "");
    setMaritalStatus(u.maritalStatus ?? "");
    setWantsChildren(u.wantsChildren ?? "");
    setHeight(u.height != null ? String(u.height) : "");
    setWeight(u.weight != null ? String(u.weight) : "");
    setBodyType(u.bodyType ?? "");
    setEyeColor(u.eyeColor ?? "");
    setHairColor(u.hairColor ?? "");
    setClothingStyle(u.clothingStyle ?? "");
    setDistinctiveFeatures(u.distinctiveFeatures ?? "");
    setPhysicalAsset(u.physicalAsset ?? "");
    setPhysicalAssetDetail(u.physicalAssetDetail ?? "");
    setPhotos(u.photos ?? []);
  };

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) {
      setUser(stored);
      fillForm(stored);
      setLoading(false);
    } else {
      setLoading(false);
    }
    (async () => {
      let res = await fetchWithAuthRetry("/api/me");
      const data = await res.json();
      if (res.ok && data.user) {
        skipAutosaveAfterServerHydrateRef.current = true;
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }
        setUser(data.user);
        fillForm(data.user);
        setServerHasUser(true);
        hasUnsavedChanges.current = false;
      } else {
        setServerHasUser(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (searchParams?.get("focus") !== "photo") return;
    const t = requestAnimationFrame(() => {
      document.getElementById("profile-photos")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(t);
  }, [searchParams]);

  type SaveProfileOpts = { reason?: "photos"; skipNameValidation?: boolean; photosOverride?: string[] };
  const saveProfileRef = useRef<(opts?: SaveProfileOpts) => Promise<void>>(() => Promise.resolve());

  const saveProfile = async (opts?: SaveProfileOpts) => {
    if (!user) return;
    const skipNameValidation = opts?.skipNameValidation === true;
    const trimmedName = name.trim();
    const nameValid = trimmedName.length >= 3 && /^\p{L}+$/u.test(trimmedName);
    if (!skipNameValidation && !nameValid) {
      setErrorDetail(tStr("pages.profile.errNameField"));
      // Nu oprim salvarea: trimitem restul (poze, data nașterii etc.) fără nume
    }
    setSaving(true);
    setMessage(null);
    if (nameValid) setErrorDetail("");
    try {
      const photosToSend = opts?.photosOverride ?? photos;
      const payload: Record<string, unknown> = {
        bio: bio.trim(),
        city: city.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        birthDate: birthDate.trim() || undefined,
        educationLevel: educationLevel.trim() || undefined,
        occupation: occupation.trim() || undefined,
        maritalStatus: maritalStatus.trim() || undefined,
        wantsChildren: wantsChildren.trim() || undefined,
        clothingStyle: clothingStyle.trim() || undefined,
        distinctiveFeatures: distinctiveFeatures.trim() || undefined,
        physical_asset: physicalAsset.trim() || undefined,
        physical_asset_detail: physicalAssetDetail.trim().slice(0, 40) || undefined,
        photos: photosToSend,
      };
      if (nameValid) payload.name = trimmedName;
      const computedAge = birthDate.trim() ? computeAgeFromBirthDate(birthDate.trim()) : null;
      if (computedAge != null) payload.age = computedAge;
      if (gender) payload.gender = gender || undefined;
      if (height) { const h = Number(height); if (h >= 100 && h <= 250) payload.height = h; }
      if (weight) { const w = Number(weight); if (w >= 30 && w <= 250) payload.weight = w; }
      if (bodyType.trim()) payload.bodyType = bodyType.trim();
      if (eyeColor.trim()) payload.eyeColor = eyeColor.trim();
      if (hairColor.trim()) payload.hairColor = hairColor.trim();
      const patchBody = JSON.stringify(payload);
      const patchHeaders = { "Content-Type": "application/json", ...getAuthHeaders() } as Record<string, string>;
      const doPatch = () =>
        fetch("/api/me", {
          method: "PATCH",
          headers: patchHeaders,
          body: patchBody,
          credentials: "include",
        });
      let res = await doPatch();
      if (res.status === 401) {
        await new Promise((r) => setTimeout(r, 450));
        res = await doPatch();
      }
      const data = await res.json();
      if (res.status === 404) {
        setMessage("not_on_server");
        return;
      }
      if (res.status === 401) {
        setMessage("error");
        setErrorDetail(tStr("pages.profile.errSessionSave"));
        return;
      }
      if (!res.ok) throw new Error(data.error || "Eroare");
      if (data.user) {
        localStorage.setItem("align_user", JSON.stringify(data.user));
        setUser(data.user);
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("align_user_updated", { detail: data.user }));
      }
      setServerHasUser(true);
      hasUnsavedChanges.current = false;
      setMessage("saved");
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
      messageTimeoutRef.current = setTimeout(() => {
        setMessage(null);
        messageTimeoutRef.current = null;
      }, 2000);
    } catch (err) {
      setMessage("error");
      const msg = err instanceof Error ? err.message : "";
      setErrorDetail(translateApiErrorMessage(msg, tStr) || msg || tStr("pages.profile.errSave"));
    } finally {
      setSaving(false);
    }
  };
  saveProfileRef.current = saveProfile;

  useEffect(() => {
    if (!user) return;
    if (skipAutosaveAfterServerHydrateRef.current) {
      skipAutosaveAfterServerHydrateRef.current = false;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      initialFormDone.current = true;
      return;
    }
    if (!initialFormDone.current) {
      initialFormDone.current = true;
      return;
    }
    hasUnsavedChanges.current = true;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      saveProfile(undefined);
    }, 400);
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [name, bio, birthDate, gender, city, postalCode, educationLevel, occupation, maritalStatus, wantsChildren, height, weight, bodyType, eyeColor, hairColor, clothingStyle, distinctiveFeatures, photos]);

  useEffect(() => {
    const flushSave = () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      if (hasUnsavedChanges.current) saveProfileRef.current(undefined);
    };
    const onBeforeUnload = () => { flushSave(); };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
      flushSave();
    };
  }, []);

  const handlePhotoPick = (file: File) => {
    if (photos.length >= MAX_PHOTOS) return;
    if (!file.type.startsWith("image/")) return;
    resizeImageAsDataUrl(file)
      .then((dataUrl) => {
        const newPhotos = [...photos.slice(0, MAX_PHOTOS - 1), dataUrl];
        setPhotos(newPhotos);
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }
        saveProfileRef.current({ reason: "photos", skipNameValidation: true, photosOverride: newPhotos });
      })
      .catch(() => {});
  };

  const handlePhotoRemove = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  /** Setează poza de la index ca poză de profil (mută-o pe prima poziție). */
  const setProfilePhoto = (index: number) => {
    if (index === 0) return;
    const arr = [...photos];
    const [chosen] = arr.splice(index, 1);
    const newOrder = [chosen, ...arr];
    setPhotos(newOrder);
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    saveProfileRef.current({ reason: "photos", skipNameValidation: true, photosOverride: newOrder });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveProfile(undefined);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-dark-500">{tStr("pages.profile.loading")}</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-12 text-center">
        <p className="text-dark-500 mb-4">{tStr("pages.profile.notAuth")}</p>
        <Link href="/login" className="text-brand-400 hover:underline">
          {tStr("pages.profile.login")}
        </Link>
        <span className="text-dark-500 mx-2">{tStr("pages.profile.or")}</span>
        <Link href="/app" className="text-brand-400 hover:underline">
          {tStr("pages.profile.backApp")}
        </Link>
      </div>
    );
  }

  const physicalOptGroup: ProfileOptGroup = gender === "male" ? "physicalMale" : "physicalFemale";

  return (
    <div>
      <h2 className="ui-page-title text-2xl mt-4">{tStr("pages.profile.title")}</h2>

      {!serverHasUser && (
        <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-950 text-sm">
          <strong>{tStr("pages.profile.serverMissingBold")}</strong> {tStr("pages.profile.serverMissingLine")}{" "}
          <Link href="/login" className="underline">{tStr("pages.profile.serverMissingLogout")}</Link> {tStr("pages.profile.serverMissingMid")}{" "}
          <Link href="/signup" className="underline">{tStr("pages.profile.serverMissingSignup")}</Link> {tStr("pages.profile.serverMissingEnd")}
        </div>
      )}

      <p className="ui-subtitle text-sm mt-2">
        {tStr("pages.profile.introMin")}
      </p>

      {/* Profil X% complet (doar afișare) */}
      {(() => {
        const fields = [
          name.trim(),
          gender,
          birthDate.trim(),
          city.trim(),
          postalCode.trim(),
          bio.trim(),
          educationLevel.trim(),
          occupation.trim(),
          maritalStatus.trim(),
          wantsChildren.trim(),
          height.trim(),
          weight.trim(),
          bodyType.trim(),
          eyeColor.trim(),
          hairColor.trim(),
          clothingStyle.trim(),
          distinctiveFeatures.trim(),
          physicalAsset.trim(),
        ];
        const filled = fields.filter(Boolean).length + (photos.length >= 1 ? 1 : 0);
        const total = 19;
        const percent = Math.round((filled / total) * 100);
        return (
          <div className="mt-4 max-w-2xl">
            <p className="text-sm text-dark-400">
              {tStr("pages.profile.profilePercent")}{" "}
              <span className="text-dark-200 font-medium">{percent}%</span> {tStr("pages.profile.profileComplete")}
            </p>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-dark-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500/80 transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {photos.length >= 1 && (
                <span className="inline-flex items-center rounded-full bg-dark-700 px-2.5 py-0.5 text-xs text-dark-200 border border-dark-600">
                  {tStr("pages.profile.badgePhoto")}
                </span>
              )}
              {bio.trim().length > 0 && (
                <span className="inline-flex items-center rounded-full bg-dark-700 px-2.5 py-0.5 text-xs text-dark-200 border border-dark-600">
                  {tStr("pages.profile.badgeBio")}
                </span>
              )}
              <Link
                href="/app/profiles?preview=me"
                className="inline-flex items-center rounded-full bg-brand-500/20 px-3 py-1.5 text-xs font-medium text-brand-400 border border-brand-500/50 hover:bg-brand-500/30 transition"
              >
                {tStr("pages.profile.previewMe")}
              </Link>
            </div>
          </div>
        );
      })()}

      {/* Rezumat profil: doar câmpurile completate */}
      {(name.trim() || bio.trim() || birthDate.trim() || gender || city.trim() || postalCode.trim() || educationLevel.trim() || occupation.trim() || maritalStatus.trim() || wantsChildren.trim() || (birthDate.trim() && computeAgeFromBirthDate(birthDate.trim()) != null) || height.trim() || weight.trim() || bodyType.trim() || eyeColor.trim() || hairColor.trim() || clothingStyle.trim() || distinctiveFeatures.trim() || physicalAsset.trim() || physicalAssetDetail.trim()) && (
        <section className="mt-4 p-4 rounded-2xl bg-dark-800/50 border border-dark-600 max-w-2xl">
          <h3 className="text-sm font-semibold text-zinc-900 mb-3">{tStr("pages.profile.summaryTitle")}</h3>
          <dl className="space-y-1.5 text-sm">
            {name.trim() && <><dt className="text-dark-500 inline">{tStr("pages.profile.lblFirstName")} </dt><dd className="inline text-dark-200">{name.trim()}</dd></>}
            {gender && <><dt className="text-dark-500 inline">{tStr("pages.profile.lblGender")} </dt><dd className="inline text-dark-200">{gender === "male" ? tStr("pages.signup.genderMale") : gender === "female" ? tStr("pages.signup.genderFemale") : tStr("pages.signup.genderOther")}</dd></>}
            {birthDate.trim() && <><dt className="text-dark-500 inline">{tStr("pages.profile.lblBirth")} </dt><dd className="inline text-dark-200">{birthDate.trim()}</dd></>}
            {city.trim() && <><dt className="text-dark-500 inline">{tStr("pages.profile.lblCity")} </dt><dd className="inline text-dark-200">{city.trim()}</dd></>}
            {postalCode.trim() && <><dt className="text-dark-500 inline">{tStr("pages.profile.lblPostal")} </dt><dd className="inline text-dark-200">{postalCode.trim()}</dd></>}
            {educationLevel.trim() && <><dt className="text-dark-500 inline">{tStr("pages.profile.lblEdu")} </dt><dd className="inline text-dark-200">{trOpt(tStr, "education", educationLevel.trim())}</dd></>}
            {occupation.trim() && <><dt className="text-dark-500 inline">{tStr("pages.profile.lblOcc")} </dt><dd className="inline text-dark-200">{occupation.trim()}</dd></>}
            {maritalStatus.trim() && <><dt className="text-dark-500 inline">{tStr("pages.profile.lblMarital")} </dt><dd className="inline text-dark-200">{trOpt(tStr, "marital", maritalStatus.trim())}</dd></>}
            {wantsChildren.trim() && <><dt className="text-dark-500 inline">{tStr("pages.profile.lblChildren")} </dt><dd className="inline text-dark-200">{trOpt(tStr, "wantsChildren", wantsChildren.trim())}</dd></>}
            {birthDate.trim() && computeAgeFromBirthDate(birthDate.trim()) != null && (
              <>
                <dt className="text-dark-500 inline">{tStr("pages.profile.lblAge")} </dt>
                <dd className="inline text-dark-200">
                  {formatTpl(tStr("pages.userPublic.ageYears"), { n: computeAgeFromBirthDate(birthDate.trim())! })}
                </dd>
              </>
            )}
            {height.trim() && <><dt className="text-dark-500 inline">{tStr("pages.profile.lblHeight")} </dt><dd className="inline text-dark-200">{formatTpl(tStr("pages.userPublic.heightCm"), { n: height.trim() })}</dd></>}
            {weight.trim() && <><dt className="text-dark-500 inline">{tStr("pages.profile.lblWeight")} </dt><dd className="inline text-dark-200">{formatTpl(tStr("pages.userPublic.weightKg"), { n: weight.trim() })}</dd></>}
            {bodyType.trim() && <><dt className="text-dark-500 inline">{tStr("pages.profile.lblBody")} </dt><dd className="inline text-dark-200">{trOpt(tStr, "bodyType", bodyType.trim())}</dd></>}
            {eyeColor.trim() && <><dt className="text-dark-500 inline">{tStr("pages.profile.lblEyes")} </dt><dd className="inline text-dark-200">{trOpt(tStr, "eye", eyeColor.trim())}</dd></>}
            {hairColor.trim() && <><dt className="text-dark-500 inline">{tStr("pages.profile.lblHair")} </dt><dd className="inline text-dark-200">{trOpt(tStr, "hair", hairColor.trim())}</dd></>}
            {clothingStyle.trim() && <><dt className="text-dark-500 inline">{tStr("pages.profile.lblClothing")} </dt><dd className="inline text-dark-200">{trOpt(tStr, "clothing", clothingStyle.trim())}</dd></>}
            {distinctiveFeatures.trim() && <><dt className="text-dark-500 inline">{tStr("pages.profile.lblFeatures")} </dt><dd className="inline text-dark-200">{distinctiveFeatures.trim()}</dd></>}
            {physicalAsset.trim() && (
              <>
                <dt className="text-dark-500 inline">{tStr("pages.profile.lblPhysical")} </dt>
                <dd className="inline text-dark-200">
                  {trOpt(tStr, physicalOptGroup, physicalAsset.trim())}{physicalAssetDetail.trim() ? ` (${physicalAssetDetail.trim()})` : ""}
                </dd>
              </>
            )}
            {bio.trim() && <><dt className="text-dark-500 block mt-2">{tStr("pages.profile.lblBio")} </dt><dd className="text-dark-200 block">{bio.trim()}</dd></>}
          </dl>
        </section>
      )}

      <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">
        <div>
          <ProfilePhotosGallery
            photos={photos}
            onPickFile={handlePhotoPick}
            onRemove={handlePhotoRemove}
            onSetMain={setProfilePhoto}
            tStr={tStr}
          />
        </div>

        {/* 1. Date personale */}
        <section className="p-5 rounded-2xl bg-dark-800/50 border border-dark-600">
          <h3 className="text-base font-semibold text-zinc-900 mb-4">{tStr("pages.profile.secPersonal")}</h3>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>{tStr("pages.profile.lblNameReq")}</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
              {name.trim().length > 0 && (name.trim().length < 3 || !/^\p{L}+$/u.test(name.trim())) && (
                <p className="text-red-400 text-xs mt-1">{tStr("pages.profile.errNameField")}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{tStr("pages.profile.lblGenderReq")}</label>
                <select value={gender} onChange={(e) => setGender(e.target.value)} required className={inputClass}>
                  <option value="">{tStr("pages.profile.selectDash")}</option>
                  <option value="male">{tStr("pages.signup.genderMale")}</option>
                  <option value="female">{tStr("pages.signup.genderFemale")}</option>
                  <option value="other">{tStr("pages.signup.genderOther")}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{tStr("pages.profile.lblBirthOpt")}</label>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={parseBirthDate(birthDate).day}
                    onChange={(e) => setBirthDate(buildBirthDate(e.target.value, parseBirthDate(birthDate).month, parseBirthDate(birthDate).year))}
                    onBlur={(e) => {
                      const v = (e.target as HTMLSelectElement).value;
                      if (v !== "") setBirthDate(buildBirthDate(v, parseBirthDate(birthDate).month, parseBirthDate(birthDate).year));
                    }}
                    className={inputClass}
                  >
                    <option value="">{tStr("common.day")}</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={String(n)}>{n}</option>
                    ))}
                  </select>
                  <select
                    value={parseBirthDate(birthDate).month}
                    onChange={(e) => setBirthDate(buildBirthDate(parseBirthDate(birthDate).day, e.target.value, parseBirthDate(birthDate).year))}
                    onBlur={(e) => {
                      const v = (e.target as HTMLSelectElement).value;
                      if (v !== "") setBirthDate(buildBirthDate(parseBirthDate(birthDate).day, v, parseBirthDate(birthDate).year));
                    }}
                    className={inputClass}
                  >
                    <option value="">{tStr("common.month")}</option>
                    {monthLabels.slice(1).map((label, i) => (
                      <option key={i} value={String(i + 1).padStart(2, "0")}>{label}</option>
                    ))}
                  </select>
                  <select
                    value={parseBirthDate(birthDate).year}
                    onChange={(e) => setBirthDate(buildBirthDate(parseBirthDate(birthDate).day, parseBirthDate(birthDate).month, e.target.value))}
                    onBlur={(e) => {
                      const v = (e.target as HTMLSelectElement).value;
                      if (v !== "") setBirthDate(buildBirthDate(parseBirthDate(birthDate).day, parseBirthDate(birthDate).month, v));
                    }}
                    className={inputClass}
                  >
                    <option value="">{tStr("common.year")}</option>
                    {(() => {
                      const end = new Date().getFullYear() - 18;
                      const start = end - 82;
                      return Array.from({ length: end - start + 1 }, (_, i) => end - i);
                    })().map((y) => (
                      <option key={y} value={String(y)}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{tStr("pages.profile.lblCityOpt")}</label>
                <input type="text" placeholder={tStr("pages.profile.phCity")} value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{tStr("pages.profile.lblPostalOpt")}</label>
                <input type="text" placeholder={tStr("pages.profile.phPostal")} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>{tStr("pages.profile.lblEduOpt")}</label>
              <select value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)} className={inputClass}>
                {EDUCATION_OPTIONS.map((o) => (
                  <option key={o || "x"} value={o}>{o ? trOpt(tStr, "education", o) : tStr("pages.profile.selectDash")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{tStr("pages.profile.lblOccOpt")}</label>
              <input type="text" placeholder={tStr("pages.profile.phOcc")} value={occupation} onChange={(e) => setOccupation(e.target.value)} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{tStr("pages.profile.lblMaritalOpt")}</label>
                <select value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)} className={inputClass}>
                  {MARITAL_OPTIONS.map((o) => (
                    <option key={o || "x"} value={o}>{o ? trOpt(tStr, "marital", o) : tStr("pages.profile.selectDash")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{tStr("pages.profile.lblWantsOpt")}</label>
                <select value={wantsChildren} onChange={(e) => setWantsChildren(e.target.value)} className={inputClass}>
                  {WANTS_CHILDREN_OPTIONS.map((o) => (
                    <option key={o || "x"} value={o}>{o ? trOpt(tStr, "wantsChildren", o) : tStr("pages.profile.selectDash")}</option>
                  ))}
                </select>
              </div>
            </div>
            {birthDate.trim() && computeAgeFromBirthDate(birthDate.trim()) != null && (
              <div>
                <span className={labelClass}>{tStr("pages.profile.lblAge")} </span>
                <span className="text-dark-200">
                  {formatTpl(tStr("pages.userPublic.ageYears"), { n: computeAgeFromBirthDate(birthDate.trim())! })} {tStr("pages.profile.ageComputed")}
                </span>
              </div>
            )}
          </div>
        </section>

        <section className="p-5 rounded-2xl bg-dark-800/50 border border-dark-600">
          <h3 className="text-base font-semibold text-zinc-900 mb-4">{tStr("pages.profile.secPhysical")}</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{tStr("pages.profile.lblHeightOpt")}</label>
                <input type="number" min={100} max={250} placeholder="170" value={height} onChange={(e) => setHeight(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{tStr("pages.profile.lblWeightOpt")}</label>
                <input type="number" min={30} max={250} placeholder="70" value={weight} onChange={(e) => setWeight(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{tStr("pages.profile.lblEyesOpt")}</label>
                <select value={eyeColor} onChange={(e) => setEyeColor(e.target.value)} className={inputClass}>
                  {EYE_OPTIONS.map((o) => (
                    <option key={o || "x"} value={o}>{o ? trOpt(tStr, "eye", o) : tStr("pages.profile.selectDash")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{tStr("pages.profile.lblHairOpt")}</label>
                <select value={hairColor} onChange={(e) => setHairColor(e.target.value)} className={inputClass}>
                  {HAIR_OPTIONS.map((o) => (
                    <option key={o || "x"} value={o}>{o ? trOpt(tStr, "hair", o) : tStr("pages.profile.selectDash")}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>{tStr("pages.profile.lblClothingOpt")}</label>
              <select value={clothingStyle} onChange={(e) => setClothingStyle(e.target.value)} className={inputClass}>
                {CLOTHING_STYLE_OPTIONS.map((o) => (
                  <option key={o || "x"} value={o}>{o ? trOpt(tStr, "clothing", o) : tStr("pages.profile.selectDash")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{tStr("pages.profile.lblFeaturesOpt")}</label>
              <input type="text" placeholder={tStr("pages.profile.phFeatures")} value={distinctiveFeatures} onChange={(e) => setDistinctiveFeatures(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{tStr("pages.profile.lblBodyOpt")}</label>
              <select value={bodyType} onChange={(e) => setBodyType(e.target.value)} className={inputClass}>
                {BODY_TYPE_OPTIONS.map((o) => (
                  <option key={o || "x"} value={o}>{o ? trOpt(tStr, "bodyType", o) : tStr("pages.profile.selectDash")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{tStr("pages.profile.lblPhysicalOpt")}</label>
              <select value={physicalAsset} onChange={(e) => setPhysicalAsset(e.target.value)} className={inputClass}>
                {(gender === "male" ? PHYSICAL_ASSET_MALE : PHYSICAL_ASSET_FEMALE).map((o) => (
                  <option key={o || "x"} value={o}>
                    {o ? trOpt(tStr, gender === "male" ? "physicalMale" : "physicalFemale", o) : tStr("pages.profile.selectDash")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{tStr("pages.profile.lblDetailOpt")}</label>
              <input type="text" maxLength={40} placeholder={tStr("pages.profile.phDetailMax")} value={physicalAssetDetail} onChange={(e) => setPhysicalAssetDetail(e.target.value.slice(0, 40))} className={inputClass} />
            </div>
          </div>
        </section>

        {/* Descriere */}
        <div>
          <label className={labelClass}>{tStr("pages.profile.lblBioOpt")}</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder={tStr("pages.profile.phBio")} rows={4} className={`${inputClass} resize-y min-h-[100px]`} />
        </div>

        {message === "saved" && (
          <p className="text-green-400 text-sm">{tStr("pages.profile.autoSaved")}</p>
        )}
        {message === "error" && (
          <p className="text-red-400 text-sm">
            {translateApiErrorMessage(errorDetail, tStr) || errorDetail || tStr("pages.profile.errSave")}
            {/sesiune|session|Sitzung|ieși|sign out|log ?out|Abmelden|cookie/i.test(errorDetail) && (
              <>{" "}<Link href="/login" className="underline font-medium">{tStr("pages.profile.loginNowLink")}</Link></>
            )}
          </p>
        )}
        {message === "not_on_server" && (
          <p className="text-red-400 text-sm">
            {tStr("pages.profile.errNotOnServerLine1")}{" "}
            <Link href="/login" className="underline">{tStr("pages.profile.linkLogout")}</Link> {tStr("pages.profile.errNotOnServerBetween")}{" "}
            <Link href="/signup" className="underline">{tStr("pages.profile.linkSignup")}</Link> {tStr("pages.profile.errNotOnServerEnd")}
          </p>
        )}
        {saving && <p className="text-dark-400 text-sm">{tStr("pages.profile.saving")}</p>}

        <section className="mt-10 pt-8 border-t border-dark-600">
          <h3 className="text-base font-semibold text-zinc-900 mb-2">{tStr("pages.profile.privacyTitle")}</h3>
          <p className="text-dark-500 text-sm mb-3">
            {tStr("pages.profile.privacyIntro")}
          </p>
          <PrivacySettingsSection />
        </section>

        <section className="mt-10 pt-8 border-t border-dark-600">
          <h3 className="text-base font-semibold text-zinc-900 mb-2">{tStr("pages.profile.accountTitle")}</h3>
          <p className="text-dark-500 text-sm mb-3">
            {tStr("pages.profile.accountIntro")}
          </p>
          <button
            type="button"
            disabled={logoutAllLoading}
            onClick={async () => {
              setLogoutAllLoading(true);
              try {
                const res = await fetch("/api/auth/logout-all", {
                  method: "POST",
                  credentials: "include",
                  headers: getAuthHeaders(),
                });
                if (res.ok) {
                  localStorage.removeItem("align_user");
                  sessionStorage.removeItem("align_user");
                  router.push("/login");
                  router.refresh();
                }
              } finally {
                setLogoutAllLoading(false);
              }
            }}
            className="!h-11 !min-h-[44px] !max-h-[44px] !py-0 px-4 rounded-xl bg-dark-700 hover:bg-dark-600 border border-dark-600 text-zinc-900 font-medium text-sm transition disabled:opacity-50"
          >
            {logoutAllLoading ? tStr("pages.profile.logoutAllBusy") : tStr("pages.profile.logoutAllBtn")}
          </button>
        </section>
      </form>
    </div>
  );
}
