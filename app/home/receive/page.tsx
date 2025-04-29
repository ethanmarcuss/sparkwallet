"use client";

import { useState, useMemo, useCallback } from "react";
import { useWallet } from "@/lib/use-wallet-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QRCodeComponent from "@/components/qr-code"; // Your QR code component
import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Bitcoin, Copy, Check } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AmountInput } from "@/components/core/amount-input";

export default function ReceivePage() {
  const {
    sparkAddress,
    getBitcoinDepositAddress,
    createLightningInvoice,
    satsUsdPrice,
  } = useWallet();
  const [lightningAmountSats, setLightningAmountSats] = useState("");
  const [activeTab, setActiveTab] = useState("spark"); // Default tab
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // QR code fill color
  const qrFill = "#0a0909";
  const qrHoverColor = "#f49f1e";

  // --- Bitcoin Address ---
  const { data: btcAddress, isLoading: isLoadingBtcAddr } = useQuery({
    queryKey: ["bitcoinDepositAddress"],
    queryFn: getBitcoinDepositAddress,
    enabled: activeTab === "bitcoin", // Only fetch when tab is active
    staleTime: Infinity, // Address shouldn't change unless requested again
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // --- Lightning Invoice ---
  const {
    mutate: generateInvoice,
    data: lightningInvoiceData, // { invoice: { encodedInvoice: string }, paymentHash: string }
    isPending: isGeneratingInvoice,
    error: invoiceError,
    reset: resetInvoice,
  } = useMutation({
    mutationFn: async ({ amount, memo }: { amount: number; memo: string }) => {
      return createLightningInvoice(amount, memo);
    },
    onSuccess: () => {
      toast("Lightning Invoice Generated");
      const checkInterval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["wallet", "balance"] });
      }, 5000);
      setTimeout(() => {
        clearInterval(checkInterval);
      }, 10 * 60 * 1000);
    },
    onError: (err) => {
      toast.error("Failed to Generate Invoice", {
        description: (err as Error).message,
      });
    },
  });

  const handleGenerateInvoice = () => {
    const amount = parseInt(lightningAmountSats, 10);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount in sats.");
      return;
    }
    generateInvoice({ amount, memo: "Spark Wallet Deposit" });
  };

  const copyToClipboard = useCallback(
    (text: string | undefined, type: string) => {
      if (!text) return;
      navigator.clipboard
        .writeText(text)
        .then(() => {
          toast(`${type} Copied!`);
          setCopiedType(type);
          setTimeout(() => setCopiedType(null), 2000); // Reset after 2 seconds
        })
        .catch(() => toast.error("Failed to copy"));
    },
    [toast] // Removed toast from dependencies as it's likely stable
  );

  // Helper to get current display data based on activeTab
  const currentDisplayData = useMemo(() => {
    switch (activeTab) {
      case "bitcoin":
        return {
          qrValue: btcAddress,
          address: btcAddress,
          label: "Bitcoin Address",
          description: "Receive Bitcoin on-chain, requires confirmations.",
          copyType: "Bitcoin Address",
          isLoading: isLoadingBtcAddr,
          showInput: false,
        };
      case "lightning":
        // Show QR/Address only if an invoice exists
        const hasInvoice = !!lightningInvoiceData?.invoice?.encodedInvoice;
        return {
          qrValue: hasInvoice
            ? lightningInvoiceData.invoice.encodedInvoice
            : undefined,
          address: hasInvoice
            ? lightningInvoiceData.invoice.encodedInvoice
            : undefined,
          label: "Lightning Invoice",
          description: hasInvoice
            ? `Scan or copy this Lightning invoice to receive ${Number(
                lightningAmountSats
              ).toLocaleString()} sats.`
            : "Enter an amount in sats to generate a Lightning invoice.",
          copyType: "Lightning Invoice",
          isLoading: isGeneratingInvoice && !hasInvoice, // Loading state for generation
          showInput: !hasInvoice, // Show input form if no invoice yet
        };
      case "spark":
      default:
        return {
          qrValue: sparkAddress,
          address: sparkAddress,
          label: "Spark Address",
          description: "Receive instant transfers from other Spark users.",
          copyType: "Spark Address",
          isLoading: false, // Assuming sparkAddress is readily available
          showInput: false,
        };
    }
  }, [
    activeTab,
    sparkAddress,
    btcAddress,
    isLoadingBtcAddr,
    lightningInvoiceData,
    isGeneratingInvoice,
    lightningAmountSats,
  ]);

  const renderQrCode = (value: string | undefined) => {
    // Determine if we should show a skeleton or nothing
    const showSkeleton =
      currentDisplayData.isLoading || (!value && activeTab === "bitcoin"); // Show skeleton if loading or bitcoin addr not ready
    const hideQrArea =
      !value && currentDisplayData.showInput && activeTab === "lightning"; // Hide area completely if showing lightning input

    if (hideQrArea) return null;
    if (showSkeleton) return <Skeleton className="w-64 h-64 mx-auto mt-4" />;

    // If we reach here, value *should* be a string, or it's spark address (always present assumed)
    // Add a final check for safety, although theoretically covered by above.
    if (!value) {
      // This case might happen for sparkAddress initially, handle gracefully
      return <Skeleton className="w-64 h-64 mx-auto mt-4" />;
    }

    // Value is guaranteed to be a string here
    return (
      <div className="mt-4">
        {" "}
        {/* Added margin top */}
        <QRCodeComponent
          value={value} // Now guaranteed to be string
          size={256}
          fill={qrFill}
          hoverEffect={true}
          hoverColor={qrHoverColor}
          className="mx-auto bg-background p-3 border rounded-lg shadow-inner"
        />
      </div>
    );
  };

  const renderAddressDisplay = (
    label: string,
    address: string | undefined,
    onCopy: () => void,
    isLoading: boolean
  ) => {
    // Don't render address display if loading or if in lightning input mode
    if (
      isLoading ||
      (currentDisplayData.showInput && activeTab === "lightning")
    )
      return null;

    return (
      <div className="w-full px-4 flex flex-col items-center">
        <Label className="text-sm font-medium mb-1 block">{label}</Label>
        <div className="flex items-center border rounded-md bg-muted overflow-hidden max-w-sm w-full">
          <div className="flex-1 pl-3 py-2 font-mono text-xs whitespace-nowrap overflow-hidden text-ellipsis">
            {address || <Skeleton className="h-4 w-full" />}
          </div>
          {address && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 flex-shrink-0"
              onClick={onCopy}
              aria-label={`Copy ${label}`}>
              {copiedType === label ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <PageContainer className="flex flex-col h-full relative">
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          // Optionally reset lightning state when switching away
          if (value !== "lightning") {
            // resetInvoice(); // Decide if you want to clear invoice on tab switch
            // setLightningAmountSats('');
          }
        }}
        className="w-full h-full">
        {/* Absolutely Positioned Main Content Area */}
        {/* Takes space above tabs, centers content, allows scrolling */}
        <div className="absolute top-0 left-0 right-0 bottom-16 p-4 flex flex-col items-center justify-center overflow-y-auto gap-4">
          {/* Description Text */}
          <p className="text-sm text-muted-foreground text-center">
            {currentDisplayData.description}
          </p>
          {/* QR Code */}
          {renderQrCode(currentDisplayData.qrValue)}
          {/* Address Display */}
          {renderAddressDisplay(
            currentDisplayData.label,
            currentDisplayData.address,
            () =>
              copyToClipboard(
                currentDisplayData.address,
                currentDisplayData.copyType
              ),
            currentDisplayData.isLoading
          )}
          {/* Tab-Specific Content Area (e.g., Lightning Input) */}
          <div className="w-full mt-4">
            <TabsContent
              value="lightning"
              className="flex flex-col items-center space-y-4">
              {currentDisplayData.showInput && (
                <>
                  {/* Input Form for Lightning */}
                  <div className="w-full max-w-xs space-y-2">
                    <AmountInput
                      onAmountChange={(amountSats) =>
                        setLightningAmountSats(amountSats.toString())
                      }
                      usdRate={satsUsdPrice.value}
                      maxAmountSats={100000000}
                    />
                  </div>
                  <Button
                    onClick={handleGenerateInvoice}
                    disabled={isGeneratingInvoice || !lightningAmountSats}
                    className="w-full max-w-xs">
                    {isGeneratingInvoice ? "Generating..." : "Generate Invoice"}
                  </Button>
                  {invoiceError && (
                    <p className="text-red-500 text-sm">
                      {invoiceError.message}
                    </p>
                  )}
                </>
              )}
              {/* "Create New" button only shows if an invoice *was* generated */}
              {lightningInvoiceData?.invoice?.encodedInvoice &&
                !currentDisplayData.showInput && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setLightningAmountSats("");
                      resetInvoice();
                    }}>
                    Create New Invoice
                  </Button>
                )}
            </TabsContent>
            <TabsContent value="spark" />
            <TabsContent value="bitcoin">
              {isLoadingBtcAddr && activeTab === "bitcoin" && (
                <p className="text-sm text-muted-foreground mt-2">
                  Generating address...
                </p>
              )}
            </TabsContent>
          </div>
        </div>

        {/* Absolutely Positioned Sticky Tab List */}
        {/* Adjusted classes: absolute, bottom-0, h-16 (adjust height as needed) */}
        <div className="absolute bottom-5 left-0 right-0 h-16 px-4 pt-2 pb-4 border-t bg-background z-10 flex items-center">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="spark">Spark</TabsTrigger>
            <TabsTrigger value="bitcoin">Bitcoin</TabsTrigger>
            <TabsTrigger value="lightning">Lightning</TabsTrigger>
          </TabsList>
        </div>
      </Tabs>
    </PageContainer>
  );
}
