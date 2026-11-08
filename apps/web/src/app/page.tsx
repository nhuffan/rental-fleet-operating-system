import { LandingPage } from "@/features/landing/landing-page";

// Public marketing page. Signed-in users keep using /login → /auth/continue to reach a workspace.
export default function Home() {
  return <LandingPage contactEmail={process.env.NEXT_PUBLIC_CONTACT_EMAIL} />;
}
