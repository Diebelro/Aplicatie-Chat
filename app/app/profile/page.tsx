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
const PHOTO_MAX_SIZE = 800;

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
      resolve(canvas.toDataURL("image/jpeg", 0.85));
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
const PARTNER_PHYSICAL_OPTIONS = ["", "nu am preferințe stricte", "înălțime medie/înalt", "stil sportiv", "zâmbet", "ochi expresivi", "subțire/zvelt", "îngrijit", "natural"];
const PARTNER_LIFESTYLE_OPTIONS = ["", "nu am preferințe stricte", "activ, sport", "călătorii", "familie, casă", "cultural, concerte", "relaxat", "ambițios, carieră", "natură, outdoor"];
const PARTNER_DEAL_BREAKERS_OPTIONS = ["", "nimic anume", "fumat", "consum excesiv de alcool", "fumat și alcool", "lipsă ambiție", "lipsă sport", "religie diferită"];
const inputClass = "w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500";
const labelClass = "block text-dark-500 text-sm mb-1";

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
  const [age, setAge] = useState("");
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
  const [partnerPhysicalPreferences, setPartnerPhysicalPreferences] = useState("");
  const [partnerLifestyle, setPartnerLifestyle] = useState("");
  const [partnerDealBreakers, setPartnerDealBreakers] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<"saved" | "error" | "not_on_server" | null>(null);
  const [serverHasUser, setServerHasUser] = useState(true);
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const fillForm = (u: User) => {
    setName(u.name ?? "");
    setBio(u.bio ?? "");
    setAge(u.age != null ? String(u.age) : "");
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
    setPartnerPhysicalPreferences(u.partnerPhysicalPreferences ?? "");
    setPartnerLifestyle(u.partnerLifestyle ?? "");
    setPartnerDealBreakers(u.partnerDealBreakers ?? "");
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
      } else {
        setServerHasUser(false);
      }
    })();
  }, []);

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || photos.length >= MAX_PHOTOS) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) return;
    resizeImageAsDataUrl(file).then((dataUrl) => {
      setPhotos((prev) => [...prev.slice(0, MAX_PHOTOS - 1), dataUrl]);
    }).catch(() => {});
    e.target.value = "";
  };

  const handlePhotoRemove = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
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
        partnerPhysicalPreferences: partnerPhysicalPreferences.trim() || undefined,
        partnerLifestyle: partnerLifestyle.trim() || undefined,
        partnerDealBreakers: partnerDealBreakers.trim() || undefined,
        photos,
      };
      if (age) payload.age = Number(age);
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
      });
      const data = await res.json();
      if (res.status === 404) {
        setMessage("not_on_server");
        return;
      }
      if (!res.ok) throw new Error(data.error || "Eroare");
      if (data.user) {
        localStorage.setItem("align_user", JSON.stringify(data.user));
        setUser(data.user);
      }
      setMessage("saved");
      setServerHasUser(true);
    } catch {
      setMessage("error");
    } finally {
      setSaving(false);
    }
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
          <strong>Contul tău nu este găsit pe server</strong> (de ex. după repornirea aplicației). Datele de mai jos sunt din sesiunea ta. Poți modifica și apăsa Salvează; dacă nu merge, <Link href="/login" className="underline">ieși</Link> și <Link href="/signup" className="underline">înregistrează-te din nou</Link> cu același email.
        </div>
      )}

      <p className="text-sm text-dark-300 mt-2">
        Completează datele personale, aspectul fizic și preferințele în partener. Datele sunt folosite la căutare și potriviri.
      </p>

      <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">
        <div>
          <label className={labelClass}>Poze profil (max {MAX_PHOTOS})</label>
          <div className="flex flex-wrap gap-3 items-start">
            {photos.map((src, i) => (
              <div key={i} className="relative group">
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
              <label className={labelClass}>Prenume</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Sex</label>
                <select value={gender} onChange={(e) => setGender(e.target.value)} className={inputClass}>
                  <option value="">—</option>
                  <option value="male">Bărbat</option>
                  <option value="female">Femeie</option>
                  <option value="other">Altul</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Data nașterii</label>
                <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Oraș</label>
                <input type="text" placeholder="ex. București" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Cod poștal</label>
                <input type="text" placeholder="ex. 010101" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Nivel de educație</label>
              <select value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)} className={inputClass}>
                {EDUCATION_OPTIONS.map((o) => (
                  <option key={o || "x"} value={o}>{o || "—"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Ocupație</label>
              <input type="text" placeholder="ex. Designer, profesor" value={occupation} onChange={(e) => setOccupation(e.target.value)} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Statut marital</label>
                <select value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)} className={inputClass}>
                  {MARITAL_OPTIONS.map((o) => (
                    <option key={o || "x"} value={o}>{o || "—"}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Dorință de copii</label>
                <select value={wantsChildren} onChange={(e) => setWantsChildren(e.target.value)} className={inputClass}>
                  {WANTS_CHILDREN_OPTIONS.map((o) => (
                    <option key={o || "x"} value={o}>{o || "—"}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>Vârstă (ani)</label>
              <input type="number" min={18} max={120} placeholder="25" value={age} onChange={(e) => setAge(e.target.value)} className={inputClass} />
            </div>
          </div>
        </section>

        {/* 2. Aspect fizic */}
        <section className="p-5 rounded-2xl bg-dark-800/50 border border-dark-600">
          <h3 className="text-base font-semibold text-white mb-4">2. Aspect fizic</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Înălțime (cm)</label>
                <input type="number" min={100} max={250} placeholder="170" value={height} onChange={(e) => setHeight(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Greutate (kg) — opțional</label>
                <input type="number" min={30} max={250} placeholder="70" value={weight} onChange={(e) => setWeight(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Culoarea ochilor</label>
                <select value={eyeColor} onChange={(e) => setEyeColor(e.target.value)} className={inputClass}>
                  {EYE_OPTIONS.map((o) => (
                    <option key={o || "x"} value={o}>{o || "—"}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Culoarea părului</label>
                <select value={hairColor} onChange={(e) => setHairColor(e.target.value)} className={inputClass}>
                  {HAIR_OPTIONS.map((o) => (
                    <option key={o || "x"} value={o}>{o || "—"}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>Stil vestimentar</label>
              <select value={clothingStyle} onChange={(e) => setClothingStyle(e.target.value)} className={inputClass}>
                {CLOTHING_STYLE_OPTIONS.map((o) => (
                  <option key={o || "x"} value={o}>{o || "—"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Trăsături distinctive (ochelari, tatuaje etc.)</label>
              <input type="text" placeholder="ex. ochelari, tatuaje discrete" value={distinctiveFeatures} onChange={(e) => setDistinctiveFeatures(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Tip corp / silueta</label>
              <select value={bodyType} onChange={(e) => setBodyType(e.target.value)} className={inputClass}>
                {BODY_TYPE_OPTIONS.map((o) => (
                  <option key={o || "x"} value={o}>{o || "—"}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Descriere */}
        <div>
          <label className={labelClass}>Descriere (despre tine)</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Scrie câteva fraze despre tine: ce îți place, cum ești, ce cauți..." rows={4} className={`${inputClass} resize-y min-h-[100px]`} />
        </div>

        {/* 3. Preferințe în partener */}
        <section className="p-5 rounded-2xl bg-dark-800/50 border border-dark-600">
          <h3 className="text-base font-semibold text-white mb-4">3. Preferințe în partener</h3>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Ce trăsături fizice preferi</label>
              <select value={partnerPhysicalPreferences} onChange={(e) => setPartnerPhysicalPreferences(e.target.value)} className={inputClass}>
                {PARTNER_PHYSICAL_OPTIONS.map((o) => (
                  <option key={o || "x"} value={o}>{o || "—"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Ce stil de viață cauți</label>
              <select value={partnerLifestyle} onChange={(e) => setPartnerLifestyle(e.target.value)} className={inputClass}>
                {PARTNER_LIFESTYLE_OPTIONS.map((o) => (
                  <option key={o || "x"} value={o}>{o || "—"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Ce obiceiuri nu tolerezi (fumat, alcool etc.)</label>
              <select value={partnerDealBreakers} onChange={(e) => setPartnerDealBreakers(e.target.value)} className={inputClass}>
                {PARTNER_DEAL_BREAKERS_OPTIONS.map((o) => (
                  <option key={o || "x"} value={o}>{o || "—"}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {message === "saved" && (
          <p className="text-green-400 text-sm">Profil salvat.</p>
        )}
        {message === "error" && (
          <p className="text-red-400 text-sm">Eroare la salvare.</p>
        )}
        {message === "not_on_server" && (
          <p className="text-red-400 text-sm">
            Contul tău nu există pe server. <Link href="/login" className="underline">Ieși</Link> și <Link href="/signup" className="underline">înregistrează-te din nou</Link> (poți folosi același email și parolă).
          </p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="!h-11 !min-h-[44px] !max-h-[44px] !py-0 px-6 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-900 font-medium text-sm transition disabled:opacity-50"
        >
          {saving ? "Se salvează..." : "Salvează"}
        </button>

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
