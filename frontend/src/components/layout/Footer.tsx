import Link from "next/link";
import { Github, Twitter } from "lucide-react";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto max-w-6xl px-4 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo.png" alt="Metl Logo" width={24} height={24} className="rounded-sm grayscale opacity-80" />
              <span className="font-bold text-lg tracking-tight">Metl</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs">
              Open Agentic Cloud Fabric. Build, deploy, and scale applications with zero vendor lock-in.
            </p>
            <div className="flex gap-4 text-muted-foreground">
              <Link href="#" className="hover:text-foreground"><Github className="w-5 h-5" /></Link>
              <Link href="#" className="hover:text-foreground"><Twitter className="w-5 h-5" /></Link>
            </div>
          </div>
          <div>
            <h3 className="font-medium mb-4">Resources</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/docs" className="hover:text-foreground">Documentation</Link></li>
              <li><Link href="/pricing" className="hover:text-foreground">Pricing</Link></li>
              <li><Link href="/about" className="hover:text-foreground">About Us</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-4">Legal</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="#" className="hover:text-foreground">Privacy Policy</Link></li>
              <li><Link href="#" className="hover:text-foreground">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Metl. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
