"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { getAuthHeaders } from "@/lib/authClient";
import { OptimizedImage } from "@/components/OptimizedImage";

const MAX_PHOTOS = 5;
const PHOTO_MAX_SIZE = 400;

function resizeImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > PHOTO_MAX_SIZE || height > PHOTO_MAX_SIZE) {
        if (width > height) {
          height = (height * PHOTO_MAX_SIZE) / width;
          width = PHOTO_MAX_SIZE;
        } else {
          width = (width * PHOTO_MAX_SIZE) / height;
          height = PHOTO_MAX_SIZE;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas")); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.65));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("load")); };
    img.src = url;
  });
}

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
const MONTH_NAMES = ["", "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];
const inputClass = "w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500";
const labelClass = "block text-dark-500 text-sm mb-1";

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

  if (loading) return <p className="text-dark-500 text-sm">Se încarcă...</p>;

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={allowFriendRequests}
          onChange={(e) => update("allowFriendRequests", e.target.checked)}
          className="rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-brand-500"
        />
        <span className="text-sm text-gray-300">Permite cereri de prietenie</span>
      </label>
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={allowVisitVisibility}
          onChange={(e) => update("allowVisitVisibility", e.target.checked)}
          className="rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-brand-500"
        />
        <span className="text-sm text-gray-300">Alții pot vedea când le vizitez profilul</span>
      </label>
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={allowReadReceipts}
          onChange={(e) => update("allowReadReceipts", e.target.checked)}
          className="rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-brand-500"
        />
        <span className="text-sm text-gray-300">Arată „citit” la mesaje (read receipts)</span>
      </label>
    </div>
  );
}

export default function ProfilePage() {
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const hasUnsavedChanges = useRef(false);
  const initialFormDone = useRef(false);

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
      const res = await fetch("/api/me", { headers: getAuthHeaders() });
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
        fillForm(data.user);
        setServerHasUser(true);
        hasUnsavedChanges.current = false;
      } else {
        setServerHasUser(false);
      }
    })();
  }, []);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  type SaveProfileOpts = { reason?: "photos"; skipNameValidation?: boolean; photosOverride?: string[] };
  const saveProfileRef = useRef<(opts?: SaveProfileOpts) => Promise<void>>(() => Promise.resolve());

  const saveProfile = async (opts?: SaveProfileOpts) => {
    if (!user) return;
    const skipNameValidation = opts?.skipNameValidation === true;
    const trimmedName = name.trim();
    const nameValid = trimmedName.length >= 3 && /^\p{L}+$/u.test(trimmedName);
    if (!skipNameValidation && !nameValid) {
      setErrorDetail("Numele trebuie să aibă cel puțin 3 litere și să conțină doar litere.");
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
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json();
      if (res.status === 404) {
        setMessage("not_on_server");
        return;
      }
      if (res.status === 401) {
        setMessage("error");
        setErrorDetail("Sesiunea a expirat. Te rugăm să te deloghezi și reconectezi din meniu (Ieșire din cont).");
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
      setErrorDetail(err instanceof Error ? err.message : "Eroare la salvare.");
    } finally {
      setSaving(false);
    }
  };
  saveProfileRef.current = saveProfile;

  useEffect(() => {
    if (!user) return;
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

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || photos.length >= MAX_PHOTOS) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) return;
    resizeImageAsDataUrl(file).then((dataUrl) => {
      const newPhotos = [...photos.slice(0, MAX_PHOTOS - 1), dataUrl];
      setPhotos(newPhotos);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      saveProfileRef.current({ reason: "photos", skipNameValidation: true, photosOverride: newPhotos });
    }).catch(() => {});
    e.target.value = "";
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
        <span className="text-dark-500">Se încarcă...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-12 text-center">
        <p className="text-dark-500 mb-4">Nu ești autentificat sau nu există date în sesiune.</p>
        <Link href="/login" className="text-brand-400 hover:underline">
          Log in
        </Link>
        <span className="text-dark-500 mx-2">sau</span>
        <Link href="/app" className="text-brand-400 hover:underline">
          Înapoi
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-white mt-4">Profilul meu</h2>

      {!serverHasUser && (
        <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-200 text-sm">
          <strong>Contul tău nu este găsit pe server</strong> (de ex. după repornirea aplicației). Datele de mai jos sunt din sesiunea ta. Modificările se salvează automat; dacă nu merge, <Link href="/login" className="underline">ieși</Link> și <Link href="/signup" className="underline">înregistrează-te din nou</Link> cu același email.
        </div>
      )}

      <p className="text-sm text-dark-300 mt-2">
        Minim obligatoriu: Prenume și Sex. Restul sunt opționale. Datele sunt folosite la căutare și potriviri. Modificările se salvează automat.
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
              Profil <span className="text-dark-200 font-medium">{percent}%</span> complet
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
                  Cu poză
                </span>
              )}
              {bio.trim().length > 0 && (
                <span className="inline-flex items-center rounded-full bg-dark-700 px-2.5 py-0.5 text-xs text-dark-200 border border-dark-600">
                  Cu descriere
                </span>
              )}
              <Link
                href="/app/profiles?preview=me"
                className="inline-flex items-center rounded-full bg-brand-500/20 px-3 py-1.5 text-xs font-medium text-brand-400 border border-brand-500/50 hover:bg-brand-500/30 transition"
              >
                Profilul meu
              </Link>
            </div>
          </div>
        );
      })()}

      {/* Rezumat profil: doar câmpurile completate */}
      {(name.trim() || bio.trim() || birthDate.trim() || gender || city.trim() || postalCode.trim() || educationLevel.trim() || occupation.trim() || maritalStatus.trim() || wantsChildren.trim() || (birthDate.trim() && computeAgeFromBirthDate(birthDate.trim()) != null) || height.trim() || weight.trim() || bodyType.trim() || eyeColor.trim() || hairColor.trim() || clothingStyle.trim() || distinctiveFeatures.trim() || physicalAsset.trim() || physicalAssetDetail.trim()) && (
        <section className="mt-4 p-4 rounded-2xl bg-dark-800/50 border border-dark-600 max-w-2xl">
          <h3 className="text-sm font-semibold text-white mb-3">Rezumat profil</h3>
          <dl className="space-y-1.5 text-sm">
            {name.trim() && <><dt className="text-dark-500 inline">Prenume: </dt><dd className="inline text-dark-200">{name.trim()}</dd></>}
            {gender && <><dt className="text-dark-500 inline">Sex: </dt><dd className="inline text-dark-200">{gender === "male" ? "Bărbat" : gender === "female" ? "Femeie" : "Altul"}</dd></>}
            {birthDate.trim() && <><dt className="text-dark-500 inline">Data nașterii: </dt><dd className="inline text-dark-200">{birthDate.trim()}</dd></>}
            {city.trim() && <><dt className="text-dark-500 inline">Oraș: </dt><dd className="inline text-dark-200">{city.trim()}</dd></>}
            {postalCode.trim() && <><dt className="text-dark-500 inline">Cod poștal: </dt><dd className="inline text-dark-200">{postalCode.trim()}</dd></>}
            {educationLevel.trim() && <><dt className="text-dark-500 inline">Educație: </dt><dd className="inline text-dark-200">{educationLevel.trim()}</dd></>}
            {occupation.trim() && <><dt className="text-dark-500 inline">Ocupație: </dt><dd className="inline text-dark-200">{occupation.trim()}</dd></>}
            {maritalStatus.trim() && <><dt className="text-dark-500 inline">Statut marital: </dt><dd className="inline text-dark-200">{maritalStatus.trim()}</dd></>}
            {wantsChildren.trim() && <><dt className="text-dark-500 inline">Dorință copii: </dt><dd className="inline text-dark-200">{wantsChildren.trim()}</dd></>}
            {birthDate.trim() && computeAgeFromBirthDate(birthDate.trim()) != null && <><dt className="text-dark-500 inline">Vârstă: </dt><dd className="inline text-dark-200">{computeAgeFromBirthDate(birthDate.trim())} ani</dd></>}
            {height.trim() && <><dt className="text-dark-500 inline">Înălțime: </dt><dd className="inline text-dark-200">{height.trim()} cm</dd></>}
            {weight.trim() && <><dt className="text-dark-500 inline">Greutate: </dt><dd className="inline text-dark-200">{weight.trim()} kg</dd></>}
            {bodyType.trim() && <><dt className="text-dark-500 inline">Tip corp: </dt><dd className="inline text-dark-200">{bodyType.trim()}</dd></>}
            {eyeColor.trim() && <><dt className="text-dark-500 inline">Ochi: </dt><dd className="inline text-dark-200">{eyeColor.trim()}</dd></>}
            {hairColor.trim() && <><dt className="text-dark-500 inline">Păr: </dt><dd className="inline text-dark-200">{hairColor.trim()}</dd></>}
            {clothingStyle.trim() && <><dt className="text-dark-500 inline">Stil vestimentar: </dt><dd className="inline text-dark-200">{clothingStyle.trim()}</dd></>}
            {distinctiveFeatures.trim() && <><dt className="text-dark-500 inline">Trăsături distinctive: </dt><dd className="inline text-dark-200">{distinctiveFeatures.trim()}</dd></>}
            {physicalAsset.trim() && <><dt className="text-dark-500 inline">Atu fizic: </dt><dd className="inline text-dark-200">{physicalAsset.trim()}{physicalAssetDetail.trim() ? ` (${physicalAssetDetail.trim()})` : ""}</dd></>}
            {bio.trim() && <><dt className="text-dark-500 block mt-2">Descriere: </dt><dd className="text-dark-200 block">{bio.trim()}</dd></>}
          </dl>
        </section>
      )}

      <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">
        <div>
          <label className={labelClass}>Poze profil (max {MAX_PHOTOS}) (opțional)</label>
          <p className="text-xs text-dark-500 mb-2">Prima poză este afișată ca poză de profil (cercul din header). Bifează alta pentru a o seta ca poză de profil.</p>
          <div className="flex flex-wrap gap-3 items-start">
            {photos.map((src, i) => (
              <div key={i} className="relative group flex flex-col items-center">
                <div className="relative">
                  <OptimizedImage src={src} alt="" width={96} height={96} className="w-24 h-24 object-cover rounded-xl border border-dark-600" />
                  <button
                    type="button"
                    onClick={() => handlePhotoRemove(i)}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-90 hover:opacity-100"
                    aria-label="Șterge poza"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <label className="mt-1.5 flex items-center gap-1.5 cursor-pointer text-xs text-dark-400 hover:text-brand-400 transition">
                  <input
                    type="radio"
                    name="profilePhoto"
                    checked={i === 0}
                    onChange={() => setProfilePhoto(i)}
                    className="rounded-full border-dark-500 text-brand-500 focus:ring-brand-500"
                  />
                  <span>{i === 0 ? "Poză de profil" : "Setează ca poză de profil"}</span>
                </label>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-24 h-24 rounded-xl border-2 border-dashed border-dark-600 flex items-center justify-center text-dark-500 hover:border-brand-500 hover:text-brand-400 transition"
              >
                <Plus className="w-8 h-8" />
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoAdd} />
          </div>
        </div>

        {/* 1. Date personale */}
        <section className="p-5 rounded-2xl bg-dark-800/50 border border-dark-600">
          <h3 className="text-base font-semibold text-white mb-4">1. Date personale</h3>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Prenume (obligatoriu)</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
              {name.trim().length > 0 && (name.trim().length < 3 || !/^\p{L}+$/u.test(name.trim())) && (
                <p className="text-red-400 text-xs mt-1">Numele trebuie să aibă cel puțin 3 litere și să conțină doar litere.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Sex (obligatoriu)</label>
                <select value={gender} onChange={(e) => setGender(e.target.value)} required className={inputClass}>
                  <option value="">—</option>
                  <option value="male">Bărbat</option>
                  <option value="female">Femeie</option>
                  <option value="other">Altul</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Data nașterii (opțional)</label>
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
                    <option value="">Zi</option>
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
                    <option value="">Lună</option>
                    {MONTH_NAMES.slice(1).map((label, i) => (
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
                    <option value="">An</option>
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
                <label className={labelClass}>Oraș (opțional)</label>
                <input type="text" placeholder="ex. București" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Cod poștal (opțional)</label>
                <input type="text" placeholder="ex. 010101" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Nivel de educație (opțional)</label>
              <select value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)} className={inputClass}>
                {EDUCATION_OPTIONS.map((o) => (
                  <option key={o || "x"} value={o}>{o || "—"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Ocupație (opțional)</label>
              <input type="text" placeholder="ex. Designer, profesor" value={occupation} onChange={(e) => setOccupation(e.target.value)} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Statut marital (opțional)</label>
                <select value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)} className={inputClass}>
                  {MARITAL_OPTIONS.map((o) => (
                    <option key={o || "x"} value={o}>{o || "—"}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Dorință de copii (opțional)</label>
                <select value={wantsChildren} onChange={(e) => setWantsChildren(e.target.value)} className={inputClass}>
                  {WANTS_CHILDREN_OPTIONS.map((o) => (
                    <option key={o || "x"} value={o}>{o || "—"}</option>
                  ))}
                </select>
              </div>
            </div>
            {birthDate.trim() && computeAgeFromBirthDate(birthDate.trim()) != null && (
              <div>
                <span className={labelClass}>Vârstă: </span>
                <span className="text-dark-200">{computeAgeFromBirthDate(birthDate.trim())} ani (calculată din data nașterii)</span>
              </div>
            )}
          </div>
        </section>

        {/* 2. Aspect fizic */}
        <section className="p-5 rounded-2xl bg-dark-800/50 border border-dark-600">
          <h3 className="text-base font-semibold text-white mb-4">2. Aspect fizic</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Înălțime (cm) (opțional)</label>
                <input type="number" min={100} max={250} placeholder="170" value={height} onChange={(e) => setHeight(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Greutate (kg) (opțional)</label>
                <input type="number" min={30} max={250} placeholder="70" value={weight} onChange={(e) => setWeight(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Culoarea ochilor (opțional)</label>
                <select value={eyeColor} onChange={(e) => setEyeColor(e.target.value)} className={inputClass}>
                  {EYE_OPTIONS.map((o) => (
                    <option key={o || "x"} value={o}>{o || "—"}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Culoarea părului (opțional)</label>
                <select value={hairColor} onChange={(e) => setHairColor(e.target.value)} className={inputClass}>
                  {HAIR_OPTIONS.map((o) => (
                    <option key={o || "x"} value={o}>{o || "—"}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>Stil vestimentar (opțional)</label>
              <select value={clothingStyle} onChange={(e) => setClothingStyle(e.target.value)} className={inputClass}>
                {CLOTHING_STYLE_OPTIONS.map((o) => (
                  <option key={o || "x"} value={o}>{o || "—"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Trăsături distinctive (ochelari, tatuaje etc.) (opțional)</label>
              <input type="text" placeholder="ex. ochelari, tatuaje discrete" value={distinctiveFeatures} onChange={(e) => setDistinctiveFeatures(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Tip corp / silueta (opțional)</label>
              <select value={bodyType} onChange={(e) => setBodyType(e.target.value)} className={inputClass}>
                {BODY_TYPE_OPTIONS.map((o) => (
                  <option key={o || "x"} value={o}>{o || "—"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Atu fizic (opțional)</label>
              <select value={physicalAsset} onChange={(e) => setPhysicalAsset(e.target.value)} className={inputClass}>
                {(gender === "male" ? PHYSICAL_ASSET_MALE : PHYSICAL_ASSET_FEMALE).map((o) => (
                  <option key={o || "x"} value={o}>{o || "—"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Detaliu (opțional)</label>
              <input type="text" maxLength={40} placeholder="max 40 caractere" value={physicalAssetDetail} onChange={(e) => setPhysicalAssetDetail(e.target.value.slice(0, 40))} className={inputClass} />
            </div>
          </div>
        </section>

        {/* Descriere */}
        <div>
          <label className={labelClass}>Descriere (despre tine) (opțional)</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Scrie câteva fraze despre tine: ce îți place, cum ești, ce cauți..." rows={4} className={`${inputClass} resize-y min-h-[100px]`} />
        </div>

        {message === "saved" && (
          <p className="text-green-400 text-sm">Salvat automat.</p>
        )}
        {message === "error" && (
          <p className="text-red-400 text-sm">
            {errorDetail || "Eroare la salvare."}
            {errorDetail.includes("Sesiunea") && (
              <>{" "}<Link href="/login" className="underline font-medium">Loghează-te acum</Link></>
            )}
          </p>
        )}
        {message === "not_on_server" && (
          <p className="text-red-400 text-sm">
            Contul tău nu există pe server. <Link href="/login" className="underline">Ieși</Link> și <Link href="/signup" className="underline">înregistrează-te din nou</Link> (poți folosi același email și parolă).
          </p>
        )}
        {saving && <p className="text-dark-400 text-sm">Se salvează...</p>}

        <section className="mt-10 pt-8 border-t border-dark-600">
          <h3 className="text-base font-semibold text-white mb-2">Setări confidențialitate și prieteni</h3>
          <p className="text-dark-500 text-sm mb-3">
            Controlează ce informații sunt vizibile pentru alții.
          </p>
          <PrivacySettingsSection />
        </section>

        <section className="mt-10 pt-8 border-t border-dark-600">
          <h3 className="text-base font-semibold text-white mb-2">Setări cont</h3>
          <p className="text-dark-500 text-sm mb-3">
            Deloghează-te de pe toate dispozitivele (inclusiv acest browser). Va trebui să te loghezi din nou peste tot.
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
            className="!h-11 !min-h-[44px] !max-h-[44px] !py-0 px-4 rounded-xl bg-dark-700 hover:bg-dark-600 border border-dark-600 text-white font-medium text-sm transition disabled:opacity-50"
          >
            {logoutAllLoading ? "Se procesează..." : "Deloghează-mă de pe toate dispozitivele"}
          </button>
        </section>
      </form>
    </div>
  );
}
