import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "SHM Dashboard · Bridge Girder Monitor",
  description:
    "Structural Health Monitoring dashboard with live sensor streams, rolling z-score anomaly detection, and a real-time bridge girder view. Built by Rohit Acharya.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen bg-base font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
