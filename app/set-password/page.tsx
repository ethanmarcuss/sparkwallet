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
import { toast } from "sonner";

export default function SetPasswordPage() {
  const router = useRouter();
  const { saveEncryptedMnemonic } = useMnemonicStore();
  const { initWallet } = useWallet();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateWallet = async () => {
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      // Basic validation
      toast.error("Password must be at least 8 characters");
      return;
    }

    const pendingMnemonic = sessionStorage.getItem("pending_mnemonic");
    if (!pendingMnemonic) {
      toast.error("Error: Mnemonic not found. Please go back.");
      router.push("/create"); // Go back if mnemonic lost
      return;
    }

    setIsLoading(true);
    try {
      await saveEncryptedMnemonic(pendingMnemonic, password);
      // Mnemonic is now securely stored. Now initialize the wallet instance.
      await initWallet(pendingMnemonic);
      sessionStorage.removeItem("pending_mnemonic"); // Clean up temporary storage
      toast.success("Wallet Created Successfully!");
      router.replace("/home"); // Redirect to the main app
    } catch (error) {
      console.error("Wallet creation failed:", error);
      toast.error("Failed to create wallet", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Set Your Wallet Password</CardTitle>
        <CardDescription>
          This password encrypts your wallet locally. Choose a strong password.
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
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm Password</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (password === confirmPassword) {
                  handleCreateWallet();
                } else {
                  toast.error("Passwords do not match");
                }
              }
            }}
            disabled={isLoading}
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleCreateWallet}
          disabled={isLoading || !password || password !== confirmPassword}
          className="w-full">
          {isLoading ? "Creating..." : "Create Wallet"}
        </Button>
      </CardFooter>
    </Card>
  );
}
