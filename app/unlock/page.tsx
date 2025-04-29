"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMnemonicStore } from "@/lib/use-mnemonic-store";
import { useWallet } from "@/lib/use-wallet-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

// Define the same type as in use-wallet-store.ts
type InitializationStatus =
  | "idle"
  | "loading"
  | "success"
  | "needs_password"
  | "no_wallet"
  | "error";

export default function UnlockWalletPage() {
  const router = useRouter();
  const { startSession, clearEncryptedMnemonic } = useMnemonicStore();
  const { loadStoredWallet, resetWallet } = useWallet(); // Use loadStoredWallet to re-trigger init after session starts

  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnlock = async () => {
    setIsLoading(true);
    setError(null);
    console.log("Unlock: Attempting unlock..."); // Log start
    try {
      // Start the session using the provided password
      console.log("Unlock: Calling startSession..."); // Log before startSession
      await startSession(password);
      console.log("Unlock: startSession completed successfully."); // Log after startSession success
      toast.success("Session started");

      // Now attempt to load the wallet again, which should use the new session
      console.log("Unlock: Calling loadStoredWallet..."); // Log before loadStoredWallet
      const status = await loadStoredWallet();
      console.log(`Unlock: loadStoredWallet returned status: ${status}`); // Log status returned

      if (status === "success") {
        toast.success("Wallet Unlocked!");
        console.log("Unlock: Success! Redirecting to /home."); // Log success redirect
        router.replace("/home"); // Go to the main app
      } else {
        // Handle cases where it still fails (e.g., password was wrong, other init error)
        const errorMessage = `Failed to initialize wallet after starting session. Status: ${status}`;
        console.error("Unlock: loadStoredWallet failed.", errorMessage); // Log failure reason
        throw new Error(errorMessage);
      }
    } catch (err) {
      console.error("Unlock failed:", err);
      const message =
        err instanceof Error ? err.message : "Incorrect password or failed.";
      setError(message);
      toast.error("Unlock Failed", {
        description: message,
      });
      setIsLoading(false);
    }
    // Don't set isLoading false on success, as redirect happens
  };

  const performReset = () => {
    resetWallet();
    clearEncryptedMnemonic();
    toast.success("Wallet Reset", {
      description: "Redirecting to setup...",
    });
    router.push("/create");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Unlock Wallet</CardTitle>
          <CardDescription>
            Enter your password to access your wallet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && password && !isLoading) {
                  handleUnlock();
                }
              }}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleUnlock}
            disabled={isLoading || !password}
            className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Unlocking...
              </>
            ) : (
              "Unlock"
            )}
          </Button>
        </CardFooter>
      </Card>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="link" className="mt-4 text-sm">
            Forgot password? (Reset Wallet)
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you absolutely sure?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete your
              encrypted wallet data from this device and redirect you to the
              setup page.
              <strong className="block mt-2">
                Ensure you have your recovery phrase backed up before
                proceeding.
              </strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={performReset}>
              Yes, Reset Wallet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
