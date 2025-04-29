"use client";
import { useState } from "react";
import { Scanner } from "@yudiel/react-qr-scanner"; // Import the scanner

interface QrScannerProps {
  onResult: (result: string) => void;
  onError: (error: Error) => void;
}

export function QrScanner({ onResult, onError }: QrScannerProps) {
  // const [errorMsg, setErrorMsg] = useState<string | null>(null); // Keep or remove based on whether Scanner shows errors

  const handleScan = (result: any[]) => {
    // The library returns an array of detected barcodes. Use the first one.
    if (result && result.length > 0) {
      onResult(result[0].rawValue); // Access the raw value
    }
  };

  const handleError = (error: unknown) => {
    console.error("QR Scan Error:", error);
    let errorToPropagate: Error;
    if (error instanceof Error) {
      errorToPropagate = error;
    } else {
      // Create a generic Error if the type is not known
      errorToPropagate = new Error(
        `An unknown error occurred during QR scanning: ${String(error)}`
      );
    }
    // setErrorMsg(errorToPropagate.message); // Optionally set local error state
    onError(errorToPropagate); // Propagate an Error object upwards
  };

  return (
    // Optional: Keep a wrapping div for styling if needed
    <div className="aspect-square w-full max-w-sm mx-auto bg-muted rounded-lg overflow-hidden relative border">
      <Scanner
        onScan={handleScan}
        onError={handleError}
        components={{
          // Disable built-in audio, finder, etc. if desired
          audio: false,
          finder: false,
        }}
        styles={{
          // Ensure the video fills the container
          container: { width: "100%", height: "100%" },
          video: { objectFit: "cover" },
        }}
        constraints={{
          facingMode: "environment",
        }}
      />
      {/* You can overlay custom UI elements here if needed */}
      {/* Example error display if not handled by Scanner internally:
      {errorMsg && (
        <div className="absolute bottom-0 left-0 right-0 bg-red-500 text-white p-2 text-center">
          {errorMsg}
        </div>
      )} */}
    </div>
  );
}
