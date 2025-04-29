"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation"; // If using separate routes for steps
import { useWallet } from "@/lib/use-wallet-store";
import { getAddressType } from "@/lib/address-utils";
import { PageContainer } from "@/components/page-container";
import { QrScanner } from "@/components/core/qr-scanner";
import { AmountInput } from "@/components/core/amount-input";
import { Button } from "@/components/ui/button";
import { decode } from "light-bolt11-decoder";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

type SendStep =
  | "scan_or_paste"
  | "enter_amount"
  | "confirm"
  | "sending"
  | "result";
type AddressType = "bitcoin" | "spark" | "lightning" | "unknown";

interface InvoiceData {
  amountSats: number;
  description: string;
  expiry?: number;
  timestamp?: number;
  expiryDate?: Date;
  feeEstimate?: number;
}

export default function SendPage() {
  const router = useRouter();
  const {
    payLightningInvoice,
    sendTransfer,
    withdrawOnchain,
    satsUsdPrice,
    btcBalance,
    getInvoiceFeeEstimate,
  } = useWallet();
  const [step, setStep] = useState<SendStep>("scan_or_paste");
  const [recipient, setRecipient] = useState<string>("");
  const [addressType, setAddressType] = useState<AddressType>("unknown");
  const [amountSats, setAmountSats] = useState<number>(0);
  const [pastedValue, setPastedValue] = useState<string>("");
  const [isPastedValueValid, setIsPastedValueValid] = useState<boolean>(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccessTxId, setSendSuccessTxId] = useState<string | null>(null); // Could be LN payment hash or on-chain txid
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [isLoadingFee, setIsLoadingFee] = useState<boolean>(false);

  // Validate pasted value in real-time
  useEffect(() => {
    if (!pastedValue.trim()) {
      setIsPastedValueValid(false);
      return;
    }
    const type = getAddressType(pastedValue.trim());
    setIsPastedValueValid(type !== "unknown");
  }, [pastedValue]);

  const resetState = () => {
    setStep("scan_or_paste");
    setRecipient("");
    setAddressType("unknown");
    setAmountSats(0);
    setPastedValue("");
    setIsPastedValueValid(false);
    setIsSheetOpen(false);
    setSendError(null);
    setSendSuccessTxId(null);
    setInvoiceData(null);
  };

  // Get fee estimate for a lightning invoice
  const getFeeEstimate = async (invoice: string): Promise<number> => {
    try {
      setIsLoadingFee(true);
      const feeEstimate = await getInvoiceFeeEstimate(invoice);
      setIsLoadingFee(false);
      return feeEstimate;
    } catch (error) {
      console.error("Error getting fee estimate:", error);
      setIsLoadingFee(false);
      return 0; // Return 0 if estimate fails, but we should handle this better in UI
    }
  };

  // Parse a Lightning invoice to extract details
  const parseInvoice = (invoice: string): InvoiceData | null => {
    try {
      const decoded = decode(invoice);

      // Find the amount section if it exists
      const amountSection = decoded.sections.find(
        (section) => section.name === "amount"
      );
      const amountSats = amountSection ? Number(amountSection.value) / 1000 : 0; // convert msat to sat if exists

      // Find the description
      const descriptionSection = decoded.sections.find(
        (section) => section.name === "description"
      );
      const description = descriptionSection
        ? descriptionSection.value
        : "No description";

      // Find expiry and timestamp if available
      const expirySection = decoded.sections.find(
        (section) => section.name === "expiry"
      );
      const timestampSection = decoded.sections.find(
        (section) => section.name === "timestamp"
      );

      const expirySeconds = expirySection
        ? Number(expirySection.value)
        : undefined;
      const timestamp = timestampSection
        ? Number(timestampSection.value)
        : undefined;

      // Calculate expiry date if both timestamp and expiry are available
      let expiryDate;
      if (timestamp && expirySeconds) {
        expiryDate = new Date((timestamp + expirySeconds) * 1000);
      }

      return {
        amountSats,
        description,
        expiry: expirySeconds,
        timestamp,
        expiryDate,
        feeEstimate: 0, // Will be populated later
      };
    } catch (error) {
      console.error("Error parsing invoice:", error);
      return null;
    }
  };

  const processInput = useCallback(
    async (input: string) => {
      const trimmedInput = input.trim();
      let finalRecipient = trimmedInput;
      let finalAddressType: AddressType = "unknown";
      let finalAmountSats: number | null = null; // Use null to distinguish 0 from not set
      let finalInvoiceData: InvoiceData | null = null;

      // Reset relevant states at the beginning
      setRecipient("");
      setAddressType("unknown");
      setAmountSats(0);
      setInvoiceData(null);

      // Check for BIP21 URI (case-insensitive)
      if (trimmedInput.toLowerCase().startsWith("bitcoin:")) {
        try {
          let addressPart = trimmedInput.substring(8); // Remove 'bitcoin:'
          let queryString = "";
          const queryIndex = addressPart.indexOf("?");

          if (queryIndex !== -1) {
            queryString = addressPart.substring(queryIndex + 1);
            addressPart = addressPart.substring(0, queryIndex);
          }

          // Basic validation on the main address part itself
          const addressOnlyType = getAddressType(addressPart);
          // BIP21 requires a Bitcoin address, reject others here.
          if (addressOnlyType !== "bitcoin") {
            toast.error("Invalid Bitcoin Address in URI", {
              description:
                "The address specified in the Bitcoin URI is not a valid Bitcoin address.",
            });
            return;
          }

          // Parse query string using URLSearchParams
          const params = new URLSearchParams(queryString);
          const lightningInvoice = params.get("lightning");
          const amountParam = params.get("amount"); // Amount in BTC string format

          if (lightningInvoice) {
            // --- Priority: Use Lightning invoice if present ---
            const lnInvoiceType = getAddressType(lightningInvoice);
            if (lnInvoiceType === "lightning") {
              finalRecipient = lightningInvoice;
              finalAddressType = "lightning";
              finalInvoiceData = parseInvoice(lightningInvoice); // Parse the LN invoice itself
              if (finalInvoiceData) {
                // Use amount from the *invoice* itself, ignore BIP21 amount param if LN is present
                finalAmountSats = finalInvoiceData.amountSats;

                // Get fee estimate for the invoice
                if (finalAmountSats > 0) {
                  const feeEstimate = await getFeeEstimate(lightningInvoice);
                  finalInvoiceData.feeEstimate = feeEstimate;

                  // Check if we have enough balance for amount + fee
                  const totalAmount = finalAmountSats + feeEstimate;
                  if (totalAmount > btcBalance.value) {
                    toast.error("Insufficient Balance", {
                      description: `This invoice requires ${finalAmountSats.toLocaleString()} sats plus a network fee of ${feeEstimate.toLocaleString()} sats, but you only have ${btcBalance.value.toLocaleString()} sats available.`,
                    });
                    return; // Stop processing
                  }
                }
              } else {
                // Handle case where the invoice within BIP21 is invalid
                toast.error("Invalid Lightning Invoice in URI", {
                  description:
                    "Could not parse the Lightning invoice provided in the URI.",
                });
                return; // Stop processing
              }
            } else {
              // Handle case where the 'lightning' parameter value isn't a valid invoice
              toast.error("Invalid Lightning parameter", {
                description:
                  "The 'lightning' parameter in the URI does not contain a valid invoice.",
              });
              return; // Stop processing
            }
          } else {
            // --- No Lightning invoice, use the main Bitcoin address ---
            finalRecipient = addressPart;
            finalAddressType = "bitcoin"; // We validated this earlier

            if (amountParam) {
              // Use amount from BIP21 amount parameter if present
              const amountBTC = parseFloat(amountParam);
              if (!isNaN(amountBTC) && amountBTC > 0) {
                // Convert BTC string to sats number
                finalAmountSats = Math.round(amountBTC * 100_000_000);
              } else {
                // Handle case where amount param is present but invalid
                toast.error("Invalid Amount in URI", {
                  description:
                    "The 'amount' parameter in the Bitcoin URI is invalid.",
                });
                return; // Stop processing
              }
            }
            // If no amountParam, finalAmountSats remains null, leading to amount entry step later
          }
        } catch (error) {
          // Catch errors during URI parsing itself
          console.error("Error parsing BIP21 URI:", error);
          toast.error("Invalid Bitcoin URI", {
            description: "Could not parse the provided Bitcoin URI.",
          });
          return; // Stop processing
        }
      } else {
        // --- Not a BIP21 URI, handle as a plain address/invoice ---
        finalAddressType = getAddressType(trimmedInput);
        finalRecipient = trimmedInput;

        if (finalAddressType === "lightning") {
          // Parse the plain LN invoice
          finalInvoiceData = parseInvoice(trimmedInput);
          if (finalInvoiceData) {
            finalAmountSats = finalInvoiceData.amountSats; // Get amount from invoice

            // Get fee estimate for the invoice
            if (finalAmountSats > 0) {
              const feeEstimate = await getFeeEstimate(trimmedInput);
              finalInvoiceData.feeEstimate = feeEstimate;

              // Check if we have enough balance for amount + fee
              const totalAmount = finalAmountSats + feeEstimate;
              if (totalAmount > btcBalance.value) {
                toast.error("Insufficient Balance", {
                  description: `This invoice requires ${finalAmountSats.toLocaleString()} sats plus a network fee of ${feeEstimate.toLocaleString()} sats, but you only have ${btcBalance.value.toLocaleString()} sats available.`,
                });
                return; // Stop processing
              }
            }
          } else {
            // Handle invalid plain LN invoice
            toast.error("Invalid Lightning Invoice", {
              description: "Could not parse the Lightning invoice details.",
            });
            return; // Stop processing
          }
        }
        // For plain BTC/Spark, finalAmountSats remains null -> amount entry step
      }

      // --- Common Logic after parsing any input type ---

      // Final validation check on determined type
      if (finalAddressType === "unknown") {
        toast.error("Invalid Address/Invoice/URI", {
          description:
            "Please scan or paste a valid Bitcoin address/URI, Spark address, or Lightning invoice.",
        });
        return;
      }

      // Set state based on parsing results
      setRecipient(finalRecipient);
      setAddressType(finalAddressType);
      setInvoiceData(finalInvoiceData); // Will be null unless a LN invoice was parsed

      // --- Determine next step based on parsed data ---

      if (finalAddressType === "lightning") {
        // For Lightning (parsed from BIP21 or plain invoice)
        const invoiceAmount = finalInvoiceData?.amountSats ?? 0; // Default to 0 if invoice has no amount
        setAmountSats(invoiceAmount); // Set state amount

        // Check expiry ONLY if expiry data is present
        if (
          finalInvoiceData?.expiryDate &&
          finalInvoiceData.expiryDate < new Date()
        ) {
          toast.error("Expired Invoice", {
            description:
              "This Lightning invoice has expired and cannot be paid.",
          });
          return; // Stop if expired
        }

        // Go to amount input if the invoice has no amount (zero amount)
        if (invoiceAmount === 0) {
          setStep("enter_amount");
        } else {
          // Go directly to confirm for LN if valid & sufficient balance/not expired
          setStep("confirm");
        }
      } else if (
        finalAddressType === "bitcoin" ||
        finalAddressType === "spark"
      ) {
        // For Bitcoin/Spark (parsed from BIP21 or plain address)
        if (finalAmountSats !== null && finalAmountSats >= 0) {
          // Amount was specified (e.g., from BIP21 amount=)
          setAmountSats(finalAmountSats); // Set the known amount

          // Check balance against the known amount
          if (finalAmountSats > btcBalance.value) {
            toast.error("Insufficient Balance", {
              description: `The requested amount of ${finalAmountSats.toLocaleString()} sats exceeds your balance of ${btcBalance.value.toLocaleString()} sats.`,
            });
            return; // Stop if insufficient balance for specified amount
          }
          // Go to confirm step if amount is known and balance is sufficient
          setStep("confirm");
        } else {
          // No amount specified (plain address or BIP21 without amount=)
          setAmountSats(0); // Reset amount input field
          setStep("enter_amount"); // Need user to input amount
        }
      }

      // Close the paste sheet if it was open
      setIsSheetOpen(false);
    },
    // Ensure all dependencies used within the useCallback are listed
    [btcBalance.value, getInvoiceFeeEstimate, toast]
  );

  const handleQrResult = (result: string) => {
    processInput(result);
  };

  const handleQrError = (error: Error) => {
    console.error("QR Scanner Error:", error);
    toast.error("QR Scan Failed", {
      description: "Could not scan QR code. Try pasting instead.",
    });
  };

  const handlePasteSubmit = () => {
    processInput(pastedValue);
  };

  const handleAmountConfirm = async () => {
    if (amountSats <= 0) {
      toast.error("Invalid Amount", {
        description: "Please enter an amount greater than zero.",
      });
      return;
    }

    // For zero-amount lightning invoices, get fee estimate when user enters an amount
    if (addressType === "lightning" && amountSats > 0 && invoiceData) {
      const feeEstimate = await getFeeEstimate(recipient);
      invoiceData.feeEstimate = feeEstimate;

      // Check for total (amount + fee)
      const totalAmount = amountSats + feeEstimate;
      if (totalAmount > btcBalance.value) {
        toast.error("Insufficient Balance", {
          description: `This payment requires ${amountSats.toLocaleString()} sats plus a network fee of ${feeEstimate.toLocaleString()} sats, but you only have ${btcBalance.value.toLocaleString()} sats available.`,
        });
        return;
      }
    } else if (amountSats > btcBalance.value) {
      toast.error("Insufficient Balance", {
        description: `You only have ${btcBalance.value.toLocaleString()} sats available.`,
      });
      return;
    }

    setStep("confirm");
  };

  const handleSendConfirm = async () => {
    // Double-check balance before sending
    if (addressType !== "lightning" && amountSats > btcBalance.value) {
      toast.error("Insufficient Balance", {
        description: `You only have ${btcBalance.value.toLocaleString()} sats available.`,
      });
      return;
    }

    // For Lightning invoices, check if the amount exists and if we have enough balance
    if (addressType === "lightning" && invoiceData) {
      const invoiceAmountSats =
        (invoiceData.amountSats || 0) > 0
          ? invoiceData.amountSats || 0
          : amountSats;

      // Get latest fee estimate if we don't have one yet
      if (!invoiceData.feeEstimate && invoiceAmountSats > 0) {
        invoiceData.feeEstimate = await getFeeEstimate(recipient);
      }

      const totalAmount = invoiceAmountSats + (invoiceData.feeEstimate || 0);

      if (totalAmount > btcBalance.value) {
        toast.error("Insufficient Balance", {
          description: `This payment requires ${invoiceAmountSats.toLocaleString()} sats plus a network fee of ${
            invoiceData.feeEstimate?.toLocaleString() || 0
          } sats, but you only have ${btcBalance.value.toLocaleString()} sats available.`,
        });
        return;
      }

      // Check if expired
      if (invoiceData.expiryDate && invoiceData.expiryDate < new Date()) {
        toast.error("Expired Invoice", {
          description: "This Lightning invoice has expired and cannot be paid.",
        });
        return;
      }
    }

    setStep("sending");
    setSendError(null);
    setSendSuccessTxId(null);

    try {
      let result: any; // To store potential txid/hash
      if (addressType === "lightning") {
        // For zero-amount invoices, we need to send the entered amount
        // Check if your SDK supports this; if not, we might need to modify the approach
        result = await payLightningInvoice(recipient);
        // setSendSuccessTxId(result?.paymentHash || 'Success');
        setSendSuccessTxId("Success"); // Simplified - SDK might not return hash easily
      } else if (addressType === "spark") {
        result = await sendTransfer(amountSats, recipient);
        // Spark transfers might not have an immediate trackable ID in the same way
        setSendSuccessTxId("Success");
      } else if (addressType === "bitcoin") {
        result = await withdrawOnchain(recipient, amountSats); // Assume SDK returns { txid: '...' } or similar
        // setSendSuccessTxId(result?.txid || 'Success');
        setSendSuccessTxId("Success"); // Simplified
      }
      setStep("result");
      toast.success("Send Successful!");
    } catch (error: any) {
      console.error("Send failed:", error);
      const errorMessage = error.message || "An unknown error occurred.";
      setSendError(errorMessage);
      setStep("result"); // Show error on result screen
      toast.error("Send Failed", {
        description: errorMessage,
      });
    }
  };

  // Format a date for display
  const formatDate = (date: Date): string => {
    return date.toLocaleString();
  };

  // --- Render Logic ---

  const renderScanOrPaste = () => (
    <div className="flex flex-col items-center space-y-6">
      <p className="text-muted-foreground text-center">
        Scan a QR code or paste an address/invoice.
      </p>
      <QrScanner onResult={handleQrResult} onError={handleQrError} />
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetTrigger asChild>
          <Button variant="outline">Paste Address / Invoice</Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-lg h-[85vh]">
          <SheetHeader>
            <SheetTitle>Paste Recipient</SheetTitle>
            <SheetDescription>
              Enter a Bitcoin address, Spark address, or Lightning invoice.
            </SheetDescription>
          </SheetHeader>
          <div className="p-4 space-y-2">
            <Label htmlFor="paste-input">Recipient</Label>
            <Input
              id="paste-input"
              value={pastedValue}
              onChange={(e) => setPastedValue(e.target.value)}
              placeholder="bc1..., sp1..., lnbc..."
              className={
                pastedValue
                  ? isPastedValueValid
                    ? "focus-visible:ring-green-500"
                    : "focus-visible:ring-red-500"
                  : ""
              }
            />
          </div>
          <SheetFooter>
            <Button
              onClick={handlePasteSubmit}
              className="w-full"
              disabled={!isPastedValueValid}>
              Continue
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );

  const renderAmountInput = () => (
    <div className="flex flex-col items-center space-y-6">
      <h1 className="text-2xl font-semibold text-center">Enter Amount</h1>
      <div
        className="text-sm text-muted-foreground mb-2"
        onClick={() => setAmountSats(btcBalance.value)}>
        Available balance: {btcBalance.value.toLocaleString()} sats
      </div>
      <AmountInput
        onAmountChange={setAmountSats}
        usdRate={satsUsdPrice.value}
        maxAmountSats={btcBalance.value}
      />
      <div className="flex gap-4 w-full max-w-xs">
        <Button
          variant="outline"
          onClick={() => setStep("scan_or_paste")}
          className="flex-1">
          Back
        </Button>
        <Button
          onClick={handleAmountConfirm}
          disabled={amountSats <= 0 || isLoadingFee}
          className="flex-1">
          {isLoadingFee ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Calculating Fee...
            </>
          ) : (
            "Review Send"
          )}
        </Button>
      </div>
    </div>
  );

  const renderConfirm = () => {
    const displayAmountSats =
      addressType === "lightning" && invoiceData
        ? invoiceData.amountSats
        : amountSats;
    const displayAmountUsd = (displayAmountSats * satsUsdPrice.value).toFixed(
      2
    );
    const feeEstimate =
      addressType === "lightning" && invoiceData
        ? invoiceData.feeEstimate || 0
        : 0;

    return (
      <div className="flex flex-col items-center space-y-6">
        <h1 className="text-2xl font-semibold text-center">Confirm Transfer</h1>

        {/* Display Amount Prominently */}
        {displayAmountSats > 0 && (
          <div className="text-center mb-4">
            <p className="text-4xl font-bold">${displayAmountUsd} </p>
          </div>
        )}
        {/* If invoice has no amount (0 sats), show a message */}
        {addressType === "lightning" && displayAmountSats <= 0 && (
          <div className="text-center mb-4">
            <p className="text-lg font-medium text-muted-foreground">
              (Invoice has no specified amount)
            </p>
          </div>
        )}

        <Card className="w-full max-w-md">
          <CardContent className="pt-6 space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">To ({addressType})</span>
              <span className="font-medium break-all text-right text-sm">
                {recipient.substring(0, 15)}...
                {recipient.substring(recipient.length - 8)}
              </span>
            </div>

            {addressType === "lightning" && invoiceData ? (
              // Lightning invoice details
              <>
                {/* Show Sats amount here inside the card only if > 0 */}
                {invoiceData.amountSats > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Bitcoin amount
                    </span>
                    <span className="text-muted-foreground">
                      {invoiceData.amountSats.toLocaleString()} sats
                    </span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Description</span>
                  <span className="font-medium text-sm text-right max-w-[200px] break-words">
                    {invoiceData.description}
                  </span>
                </div>

                {invoiceData.expiryDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expires</span>
                    <span className="text-sm">
                      {formatDate(invoiceData.expiryDate)}
                    </span>
                  </div>
                )}

                {/* Display fee estimate for Lightning payments */}
                {feeEstimate > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Network Fee (estimate)
                    </span>
                    <span className="text-sm">
                      {feeEstimate.toLocaleString()} sats
                    </span>
                  </div>
                )}

                {/* Show total with fee */}
                {displayAmountSats > 0 && feeEstimate > 0 && (
                  <div className="flex justify-between font-medium">
                    <span>Total with fee</span>
                    <span>
                      {(displayAmountSats + feeEstimate).toLocaleString()} sats
                    </span>
                  </div>
                )}
              </>
            ) : (
              // Bitcoin or Spark transfer details
              <>
                {/* Amount in USD moved above */}
                {/* <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">
                    ${(amountSats * satsUsdPrice.value).toFixed(2)} USD
                  </span>
                </div> */}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Bitcoin amount</span>
                  <span className="text-muted-foreground">
                    {amountSats.toLocaleString()} sats
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        <div className="flex gap-4 w-full max-w-xs">
          <Button
            variant="outline"
            onClick={() =>
              setStep(
                addressType === "lightning" ? "scan_or_paste" : "enter_amount"
              )
            }
            className="flex-1">
            Back
          </Button>
          <Button
            onClick={handleSendConfirm}
            className="flex-1"
            disabled={
              (addressType === "lightning" &&
                invoiceData?.amountSats &&
                invoiceData.amountSats + (invoiceData.feeEstimate || 0) >
                  btcBalance.value) ||
              (invoiceData?.expiryDate &&
                invoiceData.expiryDate < new Date()) ||
              isLoadingFee
            }>
            {isLoadingFee ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Confirm & Send"
            )}
          </Button>
        </div>
      </div>
    );
  };

  const renderSending = () => (
    <div className="flex flex-col items-center justify-center space-y-4 flex-1">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="text-lg font-medium">Sending...</p>
      <p className="text-muted-foreground text-sm">
        Please wait while we process your transaction.
      </p>
    </div>
  );

  const renderResult = () => (
    <div className="flex flex-col items-center justify-center space-y-4 flex-1 text-center">
      {sendError ? (
        <>
          <AlertCircle className="h-16 w-16 text-destructive" />
          <h2 className="text-2xl font-semibold">Transfer Failed</h2>
          <p className="text-muted-foreground max-w-sm">{sendError}</p>
        </>
      ) : (
        <>
          <CheckCircle className="h-16 w-16 text-green-500" />
          <h2 className="text-2xl font-semibold">Send Successful!</h2>
          <p className="text-muted-foreground max-w-sm">
            Your transaction has been submitted.
          </p>
          {/* Optionally show Tx ID if available */}
          {/* {sendSuccessTxId && sendSuccessTxId !== 'Success' && (
             <p className="text-xs font-mono break-all text-muted-foreground mt-2">ID: {sendSuccessTxId}</p>
           )} */}
        </>
      )}
      <Button onClick={resetState} className="mt-6">
        Make Another Send
      </Button>
      <Button variant="link" onClick={() => router.push("/home")}>
        Go to Home
      </Button>
    </div>
  );

  return (
    <PageContainer className="flex flex-col">
      {step === "scan_or_paste" && renderScanOrPaste()}
      {step === "enter_amount" && renderAmountInput()}
      {step === "confirm" && renderConfirm()}
      {step === "sending" && renderSending()}
      {step === "result" && renderResult()}
    </PageContainer>
  );
}
