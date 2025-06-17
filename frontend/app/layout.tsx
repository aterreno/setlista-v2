import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import PersistSearchState from "@/components/PersistSearchState"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Setlista - Concert Setlists to Spotify Playlists",
  description:
    "Search for concerts, discover setlists, and create Spotify playlists from your favorite live performances.",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <PersistSearchState />
        <Toaster />
      </body>
    </html>
  )
}
