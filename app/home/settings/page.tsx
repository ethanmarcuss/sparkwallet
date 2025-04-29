"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMnemonicStore } from "@/lib/use-mnemonic-store";
import { useWallet } from "@/lib/use-wallet-store";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/page-container";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Copy, Eye, EyeOff, LogOut, ShieldAlert, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import useWalletStore from "@/lib/use-wallet-store";

export default function SettingsPage() {
  const router = useRouter();
  const { getDecryptedMnemonic, clearEncryptedMnemonic, endSession } =
    useMnemonicStore();
  const { resetWallet, sparkAddress, pubkey } = useWallet();
  const { setInitializationStatus } = useWalletStore();
  const [password, setPassword] = useState("");
  const [decryptedMnemonic, setDecryptedMnemonic] = useState<string | null>(
    null
  );
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleRevealMnemonic = async () => {
    setError(null);
    setDecryptedMnemonic(null);
    setIsLoading(true);
    try {
      const mnemonic = await getDecryptedMnemonic(password);
      setDecryptedMnemonic(mnemonic);
      setShowMnemonic(true); // Show by default after successful decrypt
    } catch (err: any) {
      setError(err.message || "Failed to decrypt mnemonic. Check password.");
      toast.error("Decryption Failed", {
        description: err.message || "Check password.",
      });
    } finally {
      setIsLoading(false);
      setPassword(""); // Clear password field
    }
  };

  const copyToClipboard = (text: string | null) => {
    if (!text) return;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => toast.error("Failed to copy"));
  };

  const handleResetWallet = () => {
    try {
      resetWallet(); // Resets wallet store state
      clearEncryptedMnemonic(); // Clears persisted mnemonic
      toast.success("Wallet Reset", {
        description: "Your local wallet data has been cleared.",
      });
      router.replace("/create"); // Send user to create a new wallet
    } catch (err) {
      toast.error("Reset Failed", {
        description: "Could not reset wallet.",
      });
    }
  };

  const handleLogout = () => {
    try {
      console.log("Settings: Ending session and clearing session storage...");
      endSession(); // Clear session key from mnemonic store
      sessionStorage.removeItem("spark_wallet_mnemonic");
      sessionStorage.removeItem("spark_wallet_seed");

      console.log("Settings: Setting status to needs_password...");
      setInitializationStatus("needs_password"); // Update wallet state
      toast.success("Session Ended", {
        description: "Please enter your password to unlock.",
      });
      console.log("Settings: Redirecting to /unlock...");
      router.push("/unlock"); // Redirect to unlock page
    } catch (error) {
      console.error("Settings: Failed to end session:", error);
      toast.error("Logout Failed", {
        description: "Could not properly end the session.",
      });
    }
  };

  return (
    <PageContainer>
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>
      <div className="space-y-6">
        {/* Wallet Info */}
        <Card>
          <CardHeader>
            <CardTitle>Wallet Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Spark Address</span>
              <div className="flex items-center gap-1">
                <span className="font-mono break-all">
                  {sparkAddress
                    ? `${sparkAddress.substring(
                        0,
                        6
                      )}...${sparkAddress.substring(sparkAddress.length - 4)}`
                    : "..."}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => copyToClipboard(sparkAddress)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Public Key</span>
              <div className="flex items-center gap-1">
                <span className="font-mono break-all">
                  {pubkey
                    ? `${pubkey.substring(0, 6)}...${pubkey.substring(
                        pubkey.length - 4
                      )}`
                    : "..."}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => copyToClipboard(pubkey)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Backup Mnemonic */}
        <Dialog
          onOpenChange={() => {
            // Reset state when dialog closes/opens
            setPassword("");
            setDecryptedMnemonic(null);
            setError(null);
            setShowMnemonic(false);
          }}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full justify-start">
              <ShieldAlert className="mr-2 h-4 w-4" /> Backup Recovery Phrase
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Backup Recovery Phrase</DialogTitle>
              <DialogDescription>
                Enter your wallet password to reveal your recovery phrase. Keep
                it secret, keep it safe!
              </DialogDescription>
            </DialogHeader>
            {!decryptedMnemonic ? (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="backup-password">Password</Label>
                  <Input
                    id="backup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleRevealMnemonic();
                      }
                    }}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="relative p-4 border rounded-md bg-muted">
                  <pre
                    className={`whitespace-pre-wrap break-words font-mono text-sm ${
                      !showMnemonic ? "blur-sm" : ""
                    }`}>
                    {decryptedMnemonic}
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-7 w-7"
                    onClick={() => setShowMnemonic(!showMnemonic)}>
                    {showMnemonic ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(decryptedMnemonic)}
                  className="w-full">
                  <Copy className="mr-2 h-4 w-4" />{" "}
                  {copied ? "Copied!" : "Copy Phrase"}
                </Button>
              </div>
            )}
            <DialogFooter>
              {!decryptedMnemonic ? (
                <Button
                  onClick={handleRevealMnemonic}
                  disabled={isLoading || !password}>
                  {isLoading ? "Decrypting..." : "Reveal Phrase"}
                </Button>
              ) : (
                <DialogClose asChild>
                  <Button>Close</Button>
                </DialogClose>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Separator />

        {/* Logout (Clear Session) */}
        <Button
          variant="outline"
          onClick={handleLogout}
          className="w-full justify-start">
          <LogOut className="mr-2 h-4 w-4" /> End Session (Logout)
        </Button>

        {/* Reset Wallet */}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive" className="w-full justify-start">
              <Trash2 className="mr-2 h-4 w-4" /> Reset Wallet
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Are you absolutely sure?</DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete your
                encrypted wallet data from this device.
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
              <DialogClose asChild>
                <Button variant="destructive" onClick={handleResetWallet}>
                  Yes, Reset Wallet
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageContainer>
  );
}
