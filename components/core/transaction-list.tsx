"use client";

import {
  useQuery,
  keepPreviousData,
  useQueryClient,
} from "@tanstack/react-query";

import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // `shadcn-ui add alert`
import { Terminal } from "lucide-react";
import Link from "next/link";
import { Button } from "../ui/button";
import { useState, useImperativeHandle, forwardRef, useEffect } from "react";
import { TransactionItem } from "../transaction-item";
import { useWallet } from "@/lib/use-wallet-store";

// Define types based on your openapi.json (or generate them)
// Simplified example types:
interface ApiTransaction {
  id: string;
  type:
    | "spark_transfer"
    | "lightning_payment"
    | "bitcoin_deposit"
    | "bitcoin_withdrawal";
  direction: "incoming" | "outgoing";
  counterparty?: {
    pubkey?: string | null;
    identifier?: string;
    type?: string;
  } | null; // Adjusted based on potential null
  amountSats: number;
  valueUsd: number;
  timestamp: string; // ISO String date
  status: "confirmed" | "pending" | "failed";
  txid?: string | null; // For linking to explorer
}

interface AddressTransactionsResponse {
  meta: { totalItems: number; limit: number; offset: number };
  data: ApiTransaction[];
}

// Define a public ref interface
export interface TransactionListRefHandle {
  refresh: () => void;
}

// Replace with your actual API endpoint and network logic
const API_BASE_URL = "https://api.equaleyes.flashnet.xyz/"; // Or your backend URL
const DEFAULT_NETWORK = "MAINNET"; // Or dynamically get from useWallet store if needed

async function fetchTransactions(
  address: string,
  limit: number,
  offset: number,
  network: string = DEFAULT_NETWORK
): Promise<AddressTransactionsResponse> {
  const url = `${API_BASE_URL}/v1/address/${address}/transactions?network=${network}&limit=${limit}&offset=${offset}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch transactions: ${response.statusText}`);
  }
  return response.json();
}

export const TransactionList = forwardRef<
  TransactionListRefHandle,
  { sparkAddress: string }
>(function TransactionList({ sparkAddress }, ref) {
  const [offset, setOffset] = useState(0);
  const limit = 15; // Number of transactions per page
  const queryClient = useQueryClient();
  const { btcBalance } = useWallet();

  // Expose refresh method through ref
  useImperativeHandle(ref, () => ({
    refresh: () => {
      queryClient.invalidateQueries({
        queryKey: ["transactions", sparkAddress],
      });
    },
  }));

  // Listen for balance changes to refresh transactions
  useEffect(() => {
    if (btcBalance.value > 0) {
      queryClient.invalidateQueries({
        queryKey: ["transactions", sparkAddress],
      });
    }
  }, [btcBalance.value, sparkAddress, queryClient]);

  const { data, error, isLoading, isFetching, isPlaceholderData } = useQuery<
    AddressTransactionsResponse,
    Error
  >({
    queryKey: ["transactions", sparkAddress, limit, offset],
    queryFn: () => fetchTransactions(sparkAddress, limit, offset),
    placeholderData: keepPreviousData,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });

  const handleNextPage = () => {
    if (data && !isPlaceholderData && offset + limit < data.meta.totalItems) {
      setOffset((prev) => prev + limit);
    }
  };

  const handlePreviousPage = () => {
    setOffset((prev) => Math.max(0, prev - limit));
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Error Loading Transactions</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  if (!data || !data.data || data.data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm text-center py-4">
        No transactions yet.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {data.data.map((tx: ApiTransaction) => (
        <TransactionItem
          key={tx.id}
          id={tx.id}
          type={tx.type}
          direction={tx.direction}
          amountSats={tx.amountSats}
          valueUsd={tx.valueUsd}
          timestamp={tx.timestamp}
          status={tx.status}
          counterparty={tx.counterparty ?? undefined}
        />
      ))}
      {/* Pagination Controls */}
      <div className="flex justify-between items-center pt-4">
        <Button
          onClick={handlePreviousPage}
          disabled={offset === 0 || isFetching}
          variant="outline"
          size="sm">
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {Math.floor(offset / limit) + 1} of{" "}
          {Math.ceil(data.meta.totalItems / limit)}
        </span>
        <Button
          onClick={handleNextPage}
          disabled={
            isPlaceholderData ||
            offset + limit >= data.meta.totalItems ||
            isFetching
          }
          variant="outline"
          size="sm">
          Next
        </Button>
      </div>
    </div>
  );
});
