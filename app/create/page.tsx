"use client";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { generateMnemonic, validateMnemonic } from "@/lib/crypto";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function CreateWalletPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"generate" | "input">("generate");
  const [generatedMnemonic] = useState(() => generateMnemonic());
  const [inputMnemonic, setInputMnemonic] = useState("");
  const [hasConfirmedSave, setHasConfirmedSave] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isValidInput, setIsValidInput] = useState<boolean | null>(null);

  const mnemonicWords = useMemo(
    () => (mode === "generate" ? generatedMnemonic.split(" ") : []),
    [generatedMnemonic, mode]
  );

  useEffect(() => {
    if (mode !== "input") {
      setIsValidInput(null);
      return;
    }

    if (isValidInput === false || inputMnemonic.trim() === "") {
      setHasConfirmedSave(false);
    }

    const handler = setTimeout(() => {
      const trimmedMnemonic = inputMnemonic.trim();
      if (trimmedMnemonic === "") {
        setIsValidInput(null);
      } else {
        const isValid = validateMnemonic(trimmedMnemonic);
        setIsValidInput(isValid);
        if (!isValid) {
          setHasConfirmedSave(false);
        }
      }
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [inputMnemonic, mode]);

  const handleCopyToClipboard = useCallback(() => {
    if (mode !== "generate") return;
    navigator.clipboard
      .writeText(generatedMnemonic)
      .then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 1500);
      })
      .catch(() => toast.error("Failed to copy"));
  }, [generatedMnemonic, mode]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMnemonic(event.target.value);
    setHasConfirmedSave(false);
  };

  const handleToggleMode = () => {
    setMode((currentMode) =>
      currentMode === "generate" ? "input" : "generate"
    );
    setInputMnemonic("");
    setIsValidInput(null);
    setHasConfirmedSave(false);
    setIsCopied(false);
  };

  const handleContinue = () => {
    if (!hasConfirmedSave) {
      toast.error(
        `Please confirm you have ${
          mode === "generate" ? "saved your new" : "verified your existing"
        } recovery phrase.`
      );
      return;
    }

    let mnemonicToStore = "";

    if (mode === "generate") {
      mnemonicToStore = generatedMnemonic;
    } else {
      if (isValidInput !== true) {
        toast.error(
          "Invalid recovery phrase. Please check the words and try again."
        );
        setHasConfirmedSave(false);
        return;
      }
      mnemonicToStore = inputMnemonic.trim();
    }

    sessionStorage.setItem("pending_mnemonic", mnemonicToStore);
    router.push("/set-password");
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          {mode === "generate"
            ? "Your New Recovery Phrase"
            : "Enter Your Recovery Phrase"}
        </CardTitle>
        <CardDescription>
          {mode === "generate"
            ? "Write down or copy these words in the correct order and save them somewhere safe."
            : "Enter your existing 12 or 24 word recovery phrase below."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {mode === "generate" ? (
          <>
            <div className="grid grid-cols-3 gap-2 p-4 border rounded-md bg-muted">
              {mnemonicWords.map((word, index) => (
                <div key={index} className="text-center font-mono text-sm">
                  <span className="text-xs text-muted-foreground">
                    {index + 1}.{" "}
                  </span>
                  {word}
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyToClipboard}
              className="w-full">
              {isCopied ? "Copied!" : "Copy to Clipboard"}
            </Button>
          </>
        ) : (
          <div className="space-y-2">
            <Textarea
              placeholder="Enter your 12 or 24 word recovery phrase, separated by spaces..."
              value={inputMnemonic}
              onChange={handleInputChange}
              rows={4}
              className={`font-mono ${
                isValidInput === false
                  ? "border-destructive focus-visible:ring-destructive"
                  : ""
              } ${
                isValidInput === true
                  ? "border-green-500 focus-visible:ring-green-500"
                  : ""
              }`}
            />
          </div>
        )}

        <Button
          variant="link"
          onClick={handleToggleMode}
          className="p-0 h-auto text-sm">
          {mode === "generate"
            ? "Use existing phrase instead"
            : "Generate a new phrase"}
        </Button>

        <div className="flex items-center space-x-2 pt-4">
          <input
            type="checkbox"
            id="confirm-save"
            checked={hasConfirmedSave}
            onChange={(e) => setHasConfirmedSave(e.target.checked)}
            className="form-checkbox"
            disabled={mode === "input" && isValidInput === false}
          />
          <Label
            htmlFor="confirm-save"
            className={`text-sm font-medium leading-none ${
              mode === "input" && isValidInput === false
                ? "cursor-not-allowed opacity-70"
                : "peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            }`}>
            I have securely saved my new recovery phrase.
          </Label>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleContinue}
          disabled={
            !hasConfirmedSave || (mode === "input" && isValidInput !== true)
          }
          className="w-full">
          Continue
        </Button>
      </CardFooter>
    </Card>
  );
}
