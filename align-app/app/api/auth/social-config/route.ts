import { NextResponse } from "next/server";

/** Spune clientului ce butoane OAuth sunt configurate pe server (fără a expune secrete). */
export async function GET() {
  return NextResponse.json({
    google: !!(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()),
    facebook: !!(process.env.FACEBOOK_CLIENT_ID?.trim() && process.env.FACEBOOK_CLIENT_SECRET?.trim()),
    apple: !!(process.env.APPLE_ID?.trim() && process.env.APPLE_SECRET?.trim()),
    microsoft: !!(
      process.env.AZURE_AD_CLIENT_ID?.trim() && process.env.AZURE_AD_CLIENT_SECRET?.trim()
    ),
  });
}
