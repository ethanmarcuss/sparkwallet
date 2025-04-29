"use client";

import { cn } from "@/lib/utils";
import { Home, QrCode, Send, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    path: "/home",
    label: "Home",
    icon: Home,
  },
  {
    path: "/home/receive",
    label: "Receive",
    icon: QrCode,
  },
  {
    path: "/home/send",
    label: "Send",
    icon: Send,
  },
  {
    path: "/home/settings",
    label: "Settings",
    icon: Settings,
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-22 pb-2 items-center justify-around border-t bg-background px-4">
      {navItems.map((item) => {
        const isActive = pathname === item.path;
        return (
          <Link
            key={item.path}
            href={item.path}
            className={cn(
              "flex flex-col items-center justify-center gap-1",
              isActive ? "text-primary" : "text-muted-foreground/50"
            )}>
            <item.icon className="h-5 w-5" />
            <span className="text-xs">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
