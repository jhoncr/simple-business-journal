import LandingPageClient from "./LandingPageClient";

export async function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'pt-BR' }];
}

export default function LandingPage() {
  return <LandingPageClient />;
}
