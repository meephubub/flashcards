"use client";

import { CookieConsent } from "./cookie-consent";
import { useRouter } from "next/navigation";

export function CookieBannerWrapper() {
  const router = useRouter();

  return (
    <CookieConsent
      variant="default"
      onAcceptCallback={() => {
        console.log("Accepted");
      }}
      onDeclineCallback={() => {
        console.log("Declined");
        router.push("/jail");
      }}
    />
  );
}
