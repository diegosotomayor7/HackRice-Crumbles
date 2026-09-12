import type { Metadata } from "next";
import { Baloo_2 } from "next/font/google";
import "./globals.css";

const headingFont = Baloo_2({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Crumbles",
  description: "Convert intentions to actions.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Crumbles",
  },
};

export const viewport = {
  themeColor: "#f4b35e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${headingFont.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
