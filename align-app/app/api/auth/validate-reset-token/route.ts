import { NextResponse } from "next/server";
import { validateResetToken } from "@/lib/passwordReset";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token") ?? "";
    if (!token) {
      return NextResponse.json({ valid: false, error: "Lipsește token-ul." }, { status: 400 });
    }

    const valid = validateResetToken(token);
    if (!valid) {
      return NextResponse.json({
        valid: false,
        error: "Link invalid sau expirat. Cere un link nou din „Ai uitat parola?”.",
      });
    }

    return NextResponse.json({ valid: true });
  } catch {
    return NextResponse.json({ valid: false, error: "Eroare la validare." }, { status: 500 });
  }
}
