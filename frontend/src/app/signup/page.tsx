import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative">
      <Link href="/" className="absolute top-8 left-8 flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to home
      </Link>
      
      <div className="w-full max-w-md border rounded-2xl bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="mb-6">
            <Image src="/logo.png" alt="Metl Logo" width={48} height={48} className="rounded-lg shadow-sm" />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Create an account</h1>
          <p className="text-sm text-muted-foreground">Start building on the Open Agentic Cloud Fabric</p>
        </div>
        
        <form className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">Full name</label>
            <input 
              id="name"
              type="text" 
              placeholder="John Doe" 
              className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">Email address</label>
            <input 
              id="email"
              type="email" 
              placeholder="name@example.com" 
              className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <input 
              id="password"
              type="password" 
              placeholder="••••••••" 
              className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <Link 
            href="/dashboard"
            className="w-full block text-center py-2 px-4 bg-foreground text-background rounded-md font-medium hover:opacity-90 transition-opacity mt-6"
          >
            Create Account (Demo)
          </Link>
        </form>
        
        <div className="mt-8 pt-6 border-t text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account? <Link href="/signin" className="text-foreground font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
