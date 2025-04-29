"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: Error) => {
        // Don't retry on CORS errors
        if (error?.message?.includes("CORS")) {
          return false;
        }
        // Only retry twice (3 total attempts) with increasing delay
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 1000 * 60, // Consider data stale after 1 minute
      gcTime: 1000 * 60 * 5, // Keep unused data in cache for 5 minutes
    },
    mutations: {
      retry: false, // Don't retry mutations
    },
  },
});

export function QueryProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <QueryClientProvider client={queryClient}>
      <ReactQueryDevtools initialIsOpen={true} />
      {children}
    </QueryClientProvider>
  );
}
