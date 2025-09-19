import AboutPageClient from "./AboutPageClient";

export async function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'pt-BR' }];
}

export default function AboutPage() {
  return <AboutPageClient />;
}
