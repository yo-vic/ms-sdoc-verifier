import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "ClearPort", description: "Shipping document verification" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
