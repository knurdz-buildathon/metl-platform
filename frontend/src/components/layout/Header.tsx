"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Moon, Sun, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import Image from "next/image";

export function Header() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto max-w-6xl flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Metl Logo" width={24} height={24} className="rounded-sm" />
            <span className="font-bold text-lg tracking-tight">Metl</span>
          </Link>
          <nav className="hidden md:flex gap-6 text-sm font-medium text-muted-foreground">
            <Link href="/docs" className="hover:text-foreground transition-colors">Docs</Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/about" className="hover:text-foreground transition-colors">About</Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4">
            <Link href="/signin" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Sign In
            </Link>
            <Link href="/signup" className="text-sm font-medium bg-foreground text-background px-4 py-2 rounded-md hover:opacity-90 transition-opacity">
              Sign Up
            </Link>
          </div>
          
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}

          <button 
            className="md:hidden p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
      
      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b bg-background px-4 py-4 space-y-4">
          <nav className="flex flex-col gap-4 text-sm font-medium text-muted-foreground">
            <Link href="/docs" className="hover:text-foreground">Docs</Link>
            <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link href="/about" className="hover:text-foreground">About</Link>
          </nav>
          <div className="flex flex-col gap-2 pt-4 border-t">
            <Link href="/signin" className="text-sm font-medium text-center py-2 border rounded-md hover:bg-accent">
              Sign In
            </Link>
            <Link href="/signup" className="text-sm font-medium text-center py-2 bg-foreground text-background rounded-md hover:opacity-90">
              Sign Up
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
