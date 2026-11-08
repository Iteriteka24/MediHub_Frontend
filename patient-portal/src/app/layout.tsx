import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MediHub | Espace patient",
  description: "Gérez vos rendez-vous et retrouvez votre espace patient MediHub.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
