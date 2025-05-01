import { formatDistanceToNow } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, Bitcoin, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface TransactionItemProps {
  id: string; // Good
  type:
    | "spark_transfer"
    | "lightning_payment"
    | "bitcoin_deposit"
    | "bitcoin_withdrawal"; // Matches API
  direction: "incoming" | "outgoing"; // Matches API
  amountSats: number; // Matches API
  valueUsd: number; // Matches API
  timestamp: string; // Matches API (ISO string)
  status: "confirmed" | "pending" | "failed"; // Matches API
  counterparty?: {
    // Matches API (optional)
    pubkey?: string | null; // Allow null for pubkey
    identifier?: string;
    type?: string;
  } | null; // Allow null for the counterparty object itself
}

export function TransactionItem({
  id,
  type,
  direction,
  amountSats,
  valueUsd,
  timestamp,
  status,
}: TransactionItemProps) {
  const isIncoming = direction === "incoming";

  const getIcon = () => {
    // Check for failed status first
    if (status === "failed") {
      return <X className="h-5 w-5 text-red-500" />;
    }

    // Icons based on type and direction - seems logical
    if (type === "bitcoin_deposit" || type === "bitcoin_withdrawal") {
      return <Bitcoin className="h-5 w-5" />;
    }
    if (type === "lightning_payment") {
      // Zap is okay, but maybe different icon for incoming/outgoing LN?
      // For now, Zap is fine. Could differentiate later.
      return <Zap className="h-5 w-5" />;
    }
    // Default Spark Transfer icons based on direction
    return isIncoming ? (
      <ArrowDownLeft className="h-5 w-5 text-green-500" />
    ) : (
      <ArrowUpRight className="h-5 w-5 text-red-500" />
    );
  };

  const getTypeLabel = () => {
    // Clear labels based on type - good
    switch (type) {
      case "spark_transfer":
        return "Spark Transfer";
      case "lightning_payment":
        return "Lightning"; // Maybe "Lightning Payment/Receive"?
      case "bitcoin_deposit":
        return "Bitcoin Deposit";
      case "bitcoin_withdrawal":
        return "Bitcoin Withdrawal";
      default:
        return "Transaction"; // Fallback
    }
  };

  // Formatting timestamp - uses date-fns, good
  const formattedTime = formatDistanceToNow(new Date(timestamp), {
    addSuffix: true,
  });

  // Conditional styling based on status - good
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg p-3", // Base styling
        status === "pending" && "opacity-70" // Pending style
      )}>
      <Link
        key={id}
        href={id ? `/home/tx/${id}` : "#"}
        className="w-full flex items-center justify-between">
        {/* Left side: Icon */}
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          {getIcon()}
        </div>

        {/* Middle: Type and Timestamp */}
        <div className="flex-1 mx-3">
          <p className="font-medium">{getTypeLabel()}</p>
          <p className="text-xs text-muted-foreground">
            {status === "failed"
              ? "Failed"
              : status === "pending"
              ? "Pending"
              : formattedTime}
          </p>
        </div>

        {/* Right side: Amounts */}
        <div className="text-right">
          <p
            className={cn(
              "font-medium",
              isIncoming ? "text-green-500" : "text-red-500"
            )}>
            {isIncoming ? "+" : "-"}
            {amountSats.toLocaleString()} sats
          </p>
          <p className="text-xs text-muted-foreground">
            ${valueUsd.toFixed(2)}
          </p>
        </div>
      </Link>
    </div>
  );
}
