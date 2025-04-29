"use client";

import { useWallet } from "@/lib/use-wallet-store";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";

export function BalanceCard() {
  const { btcBalance, satsUsdPrice } = useWallet();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Card className="w-full overflow-hidden">
        <CardContent className="p-6">
          <Skeleton className="h-12 w-3/4 mb-2" />
          <Skeleton className="h-6 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  const balanceSats = btcBalance.value;
  const balanceUsd = balanceSats * satsUsdPrice.value;

  return (
    <Card className="shadow-none">
      <CardContent className="p-6">
        <div className="flex flex-col items-center justify-center">
          <p className="mt-2 text-4xl font-bold">${balanceUsd.toFixed(2)}</p>
          <p className="mt-1 text-sm opacity-80">
            {balanceSats.toLocaleString()} sats
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
