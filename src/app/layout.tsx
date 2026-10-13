import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import RouteLoadingBar from "@/components/RouteLoadingBar";

export const metadata: Metadata = {
  title: "AI StorySprint Editing",
  description: "Master the AI StorySprint editing workflow.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <RouteLoadingBar />
        {children}
      </body>
    </html>
  );
}
