import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import NavBar from "./NavBar";

export const metadata: Metadata = {
  title: "Dependency Obituary",
  description: "Your dependencies are dying. You just don't know it yet.",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    title: "Dependency Obituary",
    description:
      "Your dependencies are dying. You just don't know it yet. Drop your package.json and find out which ones.",
    url: "https://dependency-obituary.vercel.app",
    siteName: "Dependency Obituary",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Dependency Obituary — health scores for your dependencies",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dependency Obituary",
    description:
      "Your dependencies are dying. You just don't know it yet.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 antialiased">
        <Providers>
          <NavBar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
