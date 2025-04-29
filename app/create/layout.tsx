import React from "react";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Simple layout without nav, maybe centered content
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      {/* Add Logo or Branding here if desired */}
      {children}
    </div>
  );
}
