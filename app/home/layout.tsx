"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { useWallet } from "@/lib/use-wallet-store";
import { Skeleton } from "@/components/ui/skeleton"; // For loading state
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

// Optional: Create an Unlock Page component/route if you want to handle 'needs_password'
// import UnlockPage from '@/components/auth/unlock-page'; // Example

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { initializationStatus, initializationError } = useWallet();

  React.useEffect(() => {
    // Handle redirection based on status changes after initial render
    if (initializationStatus === "needs_password") {
      console.log("HomeLayout Guard: Needs password, redirecting to unlock...");
      // Redirect to the unlock page which we've confirmed exists
      router.replace("/unlock");
    } else if (initializationStatus === "no_wallet") {
      // Should be caught by entry page, but as a safeguard
      console.log(
        "HomeLayout Guard: No wallet found, redirecting to create..."
      );
      router.replace("/create");
    }
  }, [initializationStatus, router]);

  // Render based on status
  if (initializationStatus === "idle" || initializationStatus === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Skeleton className="w-16 h-16 rounded-lg mb-4" />
        <Skeleton className="h-4 w-32" />
        {/* Or a more elaborate skeleton mimicking the home page */}
      </div>
    );
  }

  if (initializationStatus === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Alert variant="destructive" className="max-w-md">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Wallet Initialization Failed</AlertTitle>
          <AlertDescription>
            {initializationError || "An unknown error occurred."}
            <br />
            Please try refreshing the page or resetting the wallet from settings
            (if accessible).
          </AlertDescription>
        </Alert>
        {/* Maybe add a refresh button or link to help */}
      </div>
    );
  }

  if (initializationStatus === "needs_password") {
    // User needs to be redirected, show minimal loading or message until redirect effect runs
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p>Redirecting...</p>
        {/* Or UnlockPage component if you render it directly */}
      </div>
    );
  }

  if (initializationStatus === "success") {
    // Wallet is ready, render the main app layout
    return (
      <div className="flex flex-col min-h-screen">
        <main className="flex-1 flex flex-col mb-16">
          {" "}
          {/* mb-16 ensures space for BottomNav */}
          {children}
        </main>
        <BottomNav />
      </div>
    );
  }

  // Fallback for 'no_wallet' or unexpected states (shouldn't be reached ideally)
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <p>An unexpected error occurred.</p>
    </div>
  );
}
