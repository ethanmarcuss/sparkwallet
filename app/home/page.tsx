"use client";

import Link from "next/link";
import { useWallet } from "@/lib/use-wallet-store";
import { BalanceCard } from "@/components/balance-card";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/page-container";
import { TransactionList } from "@/components/core/transaction-list"; // Create this component
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";

export default function HomePage() {
  const { sparkAddress } = useWallet(); // Need address for transactions

  return (
    <PageContainer>
      <div className="space-y-6">
        <BalanceCard />

        <div className="grid grid-cols-2 gap-4">
          <Button asChild size="lg" variant="outline">
            <Link href="/home/receive">
              <ArrowDownLeft className="mr-2 h-5 w-5" /> Receive
            </Link>
          </Button>
          <Button asChild size="lg">
            <Link href="/home/send">
              <ArrowUpRight className="mr-2 h-5 w-5" /> Send
            </Link>
          </Button>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
          {sparkAddress ? (
            <TransactionList sparkAddress={sparkAddress} />
          ) : (
            <p className="text-muted-foreground text-sm">Loading address...</p> // Or skeleton
          )}
        </div>
      </div>
    </PageContainer>
  );
}
