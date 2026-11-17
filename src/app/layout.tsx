import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/Shell";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: "SUBS - Synthetic User Behavior Simulation",
  description: "Persona-conditioned AI agents walk a product journey and log every step. Find friction before your users do.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
