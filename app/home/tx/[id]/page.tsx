"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Terminal, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns"; // For timestamp formatting

// Define type based on openapi.json /v1/tx/{txid} response (TxV1Response)
// Simplified example:
interface TxDetail {
  id: string;
  type: string; // More specific types? e.g., "spark_transfer", "bitcoin_tx"
  status: "confirmed" | "pending" | "failed";
  timestamp: string; // ISO string
  from?: { type: string; identifier: string; pubkey?: string | null } | null;
  to?: { type: string; identifier: string; pubkey?: string | null } | null;
  amountSats: number;
  valueUsd: number;
  txid?: string | null; // Bitcoin TXID if applicable
  bitcoinTxData?: {
    // Nested details for on-chain tx
    fee: number;
    vin: any[]; // Simplified
    vout: any[]; // Simplified
    status: {
      confirmed: boolean;
      block_height?: number | null;
      block_time?: number | null;
    };
  } | null;
  // Add other fields as needed (e.g., timeTakenSeconds)
}

// Replace with your actual API endpoint and network logic
const API_BASE_URL = "https://api.equaleyes.flashnet.xyz";
const DEFAULT_NETWORK = "MAINNET";

// Helper function to format transaction type
const formatTransactionType = (type: string): string => {
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

// Helper function to format identifier based on type
const formatIdentifier = (type: string, identifier: string): string => {
  if (type.toLowerCase() === "lightning") {
    return "Lightning";
  }

  if (
    ["spark", "bitcoin"].includes(type.toLowerCase()) &&
    identifier.length > 14
  ) {
    const start = identifier.slice(0, 6);
    const end = identifier.slice(-6);
    return `${start}...${end}`;
  }

  return identifier;
};

async function fetchTxDetail(
  txId: string,
  network: string = DEFAULT_NETWORK
): Promise<TxDetail> {
  // Note: The API endpoint uses txid, but your internal ID might be different.
  // Adjust the fetch based on whether you are querying by internal ID or on-chain TXID.
  // Assuming the [id] param IS the on-chain txid for this example.
  const url = `${API_BASE_URL}/v1/tx/${txId}?network=${network}`;
  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 404)
      throw new Error(`Transaction not found: ${txId}`);
    throw new Error(
      `Failed to fetch transaction details: ${response.statusText}`
    );
  }
  return response.json();
}

export default function TransactionDetailPage() {
  const params = useParams();
  const txId = params.id as string; // Get ID from URL

  const {
    data: tx,
    error,
    isLoading,
  } = useQuery<TxDetail, Error>({
    queryKey: ["transactionDetail", txId],
    queryFn: () => fetchTxDetail(txId),
    enabled: !!txId, // Only run query if txId exists
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const DetailItem = ({
    label,
    value,
    isMono = false,
  }: {
    label: string;
    value: React.ReactNode;
    isMono?: boolean;
  }) => (
    <div className="flex justify-between items-start py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`text-sm text-right break-all ${
          isMono ? "font-mono" : "font-medium"
        }`}>
        {value ?? "-"}
      </span>
    </div>
  );

  if (isLoading) {
    return (
      <PageContainer>
        <Skeleton className="h-8 w-32 mb-6" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-1/2" />
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer className="flex flex-col items-center justify-center">
        <Alert variant="destructive" className="w-full max-w-md">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error Loading Transaction</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/home">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
          </Link>
        </Button>
      </PageContainer>
    );
  }

  if (!tx) {
    // Should be covered by error state, but good practice
    return (
      <PageContainer>
        <p>Transaction not found.</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Link
        href="/home"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Home
      </Link>
      <div className="flex justify-between items-center mb-1">
        <h1 className="text-2xl font-semibold">Transaction Details</h1>
        <Button variant="ghost" size="icon" asChild>
          <a
            href={`https://sparkscan.io/tx/${tx.id}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View on Sparkscan">
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>
      <p className="text-xs font-mono text-muted-foreground break-all mb-6">
        {tx.txid || tx.id}
      </p>

      <Card>
        <CardContent className="pt-6">
          <DetailItem label="Type" value={formatTransactionType(tx.type)} />
          <DetailItem label="Status" value={tx.status.toUpperCase()} />
          <DetailItem
            label="Timestamp"
            value={formatDistanceToNow(new Date(tx.timestamp), {
              addSuffix: true,
            })}
          />
          <Separator className="my-3" />
          <DetailItem
            label="Amount"
            value={`${tx.amountSats.toLocaleString()} sats`}
          />
          <DetailItem label="Value" value={`$${tx.valueUsd.toFixed(2)} USD`} />
          {/* Display From/To based on structure */}
          {tx.from && (
            <DetailItem
              label={`From`}
              value={formatIdentifier(tx.from.type, tx.from.identifier)}
              isMono={tx.from.type.toLowerCase() !== "lightning"}
            />
          )}
          {tx.to && (
            <DetailItem
              label={`To`}
              value={formatIdentifier(tx.to.type, tx.to.identifier)}
              isMono={tx.to.type.toLowerCase() !== "lightning"}
            />
          )}

          {/* Bitcoin Specific Details */}
          {tx.bitcoinTxData && (
            <>
              <Separator className="my-3" />
              <DetailItem
                label="BTC Network Fee"
                value={`${tx.bitcoinTxData.fee.toLocaleString()} sats`}
              />
              <DetailItem
                label="BTC Confirmations"
                value={
                  tx.bitcoinTxData.status.confirmed ? "Confirmed" : "Pending"
                }
              />
              {tx.bitcoinTxData.status.block_height && (
                <DetailItem
                  label="Block Height"
                  value={tx.bitcoinTxData.status.block_height}
                />
              )}
              {/* Add link to external block explorer */}
              {tx.txid && (
                <Button
                  variant="link"
                  asChild
                  className="mt-2 p-0 h-auto justify-start">
                  <a
                    href={`https://mempool.space/tx/${tx.txid}`}
                    target="_blank"
                    rel="noopener noreferrer">
                    View on Mempool.space
                  </a>
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
