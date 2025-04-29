import type React from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  withPadding?: boolean;
  // Remove withNav prop, as it's handled by the layout now
}

// Simplified - padding and layout handled by (main)/layout.tsx
export function PageContainer({
  children,
  className,
  withPadding = true,
}: PageContainerProps) {
  return (
    <div className={cn("flex-1", withPadding && "p-4 pt-6", className)}>
      {children}
    </div>
  );
}
