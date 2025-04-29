"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMnemonicStore } from "@/lib/use-mnemonic-store";
import { Skeleton } from "@/components/ui/skeleton";

export default function EntryPage() {
  const router = useRouter();
  // Directly access the store's state, but only need encryptedMnemonic here initially
  const encryptedMnemonic = useMnemonicStore.getState().encryptedMnemonic;
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    console.log("EntryPage: useEffect check started.");
    // Zustand state might take a moment to hydrate from persistence,
    // so we re-check the state inside useEffect.
    const currentEncryptedMnemonic =
      useMnemonicStore.getState().encryptedMnemonic;
    console.log(
      "EntryPage: Checking encryptedMnemonic:",
      currentEncryptedMnemonic
    );

    if (currentEncryptedMnemonic) {
      // Wallet potentially exists, redirect to the main app.
      // The /home layout guard will handle actual initialization or password prompt.
      console.log(
        "EntryPage: Mnemonic found. Redirecting to /home (guard will handle init)..."
      );
      router.replace("/home");
    } else {
      // No mnemonic means new user.
      console.log("EntryPage: No mnemonic found. Redirecting to /create...");
      router.replace("/create");
    }

    // Setting state false happens after redirect is initiated.
    // If redirect is fast, user won't see the page anyway.
    // If there's a delay, they see loading briefly.
    setIsChecking(false);
    console.log("EntryPage: check finished.");

    // We only need this effect to run once on mount to decide the initial route.
    // The dependency array is empty.
     
  }, [router]); // Only router is needed as a stable dependency

  // Show loading indicator while determining the route.
  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Skeleton className="w-20 h-20 rounded-full" />
      </div>
    );
  }

  // Render null after check is done and redirect is initiated.
  return null;
}
