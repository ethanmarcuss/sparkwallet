"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Delete, ArrowUpDown } from "lucide-react";

interface AmountInputProps {
  onAmountChange: (amountSats: number) => void;
  initialAmountSats?: number;
  usdRate?: number; // USD per Sat (e.g., 0.0007 means 1 sat = $0.0007)
  maxAmountSats?: number; // Maximum amount in sats the user can send
}

// Default USD Rate (Example: $70,000 BTC -> 1 sat = $0.0007)
const DEFAULT_USD_RATE = 0.0007;
const MAX_DECIMALS_USD = 2;
const MAX_DECIMALS_SATS = 0; // Sats are whole numbers

// Define type for input mode
type InputMode = "usd" | "sats";

export function AmountInput({
  onAmountChange,
  initialAmountSats = 0,
  usdRate = DEFAULT_USD_RATE,
  maxAmountSats,
}: AmountInputProps) {
  // Add state for tracking input mode
  const [inputMode, setInputMode] = useState<InputMode>("usd");

  // For debugging purpose
  const [debugInfo, setDebugInfo] = useState<string>("");

  const calculateUsdFromSats = (sats: number): number => {
    if (usdRate <= 0) return 0;
    return sats * usdRate;
  };

  const calculateSatsFromUsd = (usd: number): number => {
    if (usdRate <= 0) return 0;
    // Use Math.floor to prevent exceeding max due to rounding up
    return Math.floor(usd / usdRate);
  };

  // Initialize display value based on initial sats and current input mode
  const getInitialDisplayValue = (): string => {
    if (inputMode === "usd") {
      const initialUsdValue = calculateUsdFromSats(initialAmountSats);
      // Format initial USD value
      if (initialUsdValue === 0) return "0";
      return initialUsdValue.toFixed(MAX_DECIMALS_USD);
    } else {
      // For sats mode, just return the raw sats value
      return initialAmountSats.toString();
    }
  };

  // Display value is the raw string the user is building (e.g., "123.45", "0.", "5")
  const [displayValue, setDisplayValue] = useState<string>(
    getInitialDisplayValue()
  );

  // Recalculate display value when input mode changes
  useEffect(() => {
    let newDisplayValue: string;

    if (inputMode === "usd") {
      // Convert from sats to USD
      const currentSats = parseFloat(displayValue) || 0;
      const usdValue = calculateUsdFromSats(currentSats);
      // If value is zero, just display "0" without decimals
      if (usdValue === 0) {
        newDisplayValue = "0";
      } else {
        // Truncate to avoid very long decimal values that break the UI
        newDisplayValue = usdValue.toFixed(MAX_DECIMALS_USD);
      }
    } else {
      // Convert from USD to sats
      const currentUsd = parseFloat(displayValue) || 0;
      const satsValue = calculateSatsFromUsd(currentUsd);
      newDisplayValue = satsValue.toString();
    }

    setDisplayValue(newDisplayValue);
  }, [inputMode]);

  // Calculate sats value based on display string and current mode
  const getCurrentSatsValue = (): number => {
    const value = parseFloat(displayValue) || 0;
    return inputMode === "usd" ? calculateSatsFromUsd(value) : value;
  };

  const currentSatsValue = getCurrentSatsValue();

  // Update parent component whenever the sats value changes
  useEffect(() => {
    const calculatedSats = getCurrentSatsValue();
    console.log(
      `[AmountInput Effect] displayValue: "${displayValue}", inputMode: ${inputMode}, Calculated Sats: ${calculatedSats}`
    );
    onAmountChange(calculatedSats);
    // Only trigger when displayValue or inputMode changes
  }, [displayValue, inputMode, onAmountChange]);

  const handleKeyPress = (key: string) => {
    setDisplayValue((prev) => {
      // For debugging purposes
      let reason = "";

      // Handle Delete
      if (key === "del") {
        if (prev.length === 1) {
          return "0"; // Reset to "0" if deleting the last digit
        }
        return prev.slice(0, -1);
      }

      // Handle Decimal Point
      if (key === ".") {
        // In sats mode, don't allow decimal points
        if (inputMode === "sats") {
          reason = "Decimal not allowed in sats mode";
          return prev;
        }

        // Prevent multiple decimal points
        if (prev.includes(".")) {
          reason = "Already has decimal point";
          return prev;
        }

        // Append decimal point
        return prev + ".";
      }

      // Handle Number Input
      const isDigit = /^[0-9]$/.test(key);
      if (isDigit) {
        let nextValue = prev;

        // Replace leading "0" unless adding decimal
        if (prev === "0" && key !== "0") {
          nextValue = key;
        } else if (prev !== "0" || key !== "0" || prev.includes(".")) {
          // Append digit in all other cases except multiple leading zeros
          nextValue = prev + key;
        } else {
          // This would create a string like "00" - just keep "0"
          reason = "Preventing multiple leading zeros";
          return prev;
        }

        // Check decimal places limit based on input mode
        if (nextValue.includes(".")) {
          const decimalPart = nextValue.split(".")[1];
          const maxDecimals =
            inputMode === "usd" ? MAX_DECIMALS_USD : MAX_DECIMALS_SATS;
          if (decimalPart && decimalPart.length > maxDecimals) {
            reason = `Too many decimal places (max ${maxDecimals})`;
            return prev; // Limit reached, do not append
          }
        }

        // Check against Max Amount - only if we have valid values to work with
        if (maxAmountSats && maxAmountSats > 0 && usdRate > 0) {
          let potentialSatsValue: number;

          if (inputMode === "usd") {
            const potentialUsdValue = parseFloat(nextValue) || 0;
            potentialSatsValue = calculateSatsFromUsd(potentialUsdValue);

            // Debug info
            setDebugInfo(
              `USD: ${potentialUsdValue}, Sats: ${potentialSatsValue}, Max: ${maxAmountSats}`
            );

            if (potentialSatsValue > maxAmountSats) {
              reason = `Exceeds max amount (${potentialSatsValue} > ${maxAmountSats})`;
              return prev;
            }
          } else {
            // In sats mode
            potentialSatsValue = parseFloat(nextValue) || 0;

            // Debug info
            setDebugInfo(`Sats: ${potentialSatsValue}, Max: ${maxAmountSats}`);

            if (potentialSatsValue > maxAmountSats) {
              reason = `Exceeds max amount (${potentialSatsValue} > ${maxAmountSats})`;
              return prev;
            }
          }
        }

        // All checks passed
        if (reason) {
          setDebugInfo(`Blocked: ${reason}`);
        } else {
          setDebugInfo("");
        }
        return nextValue;
      }

      // Should not happen with the defined keypad, but return prev just in case
      return prev;
    });
  };

  const keypadLayout = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    [".", "0", "del"],
  ];

  const isAtMaxAmount =
    maxAmountSats !== undefined &&
    maxAmountSats > 0 &&
    currentSatsValue >= maxAmountSats;

  // Toggle between USD and Sats input modes
  const toggleInputMode = () => {
    setInputMode((prev) => (prev === "usd" ? "sats" : "usd"));
  };

  // Format display value for user readability based on current mode
  const formatForDisplay = (value: string): string => {
    if (inputMode === "usd") {
      return `$${value}`;
    } else {
      // For sats, add commas for thousands
      const numValue = parseInt(value, 10) || 0;
      return `${numValue.toLocaleString()} sats`;
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* Display Area */}
      <div className="text-center mb-6 px-4 w-full min-h-[100px] flex flex-col justify-center">
        {/* Currency Toggle Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleInputMode}
          className="self-center mb-2 flex items-center gap-1">
          <span>{inputMode === "usd" ? "USD" : "SATS"}</span>
          <ArrowUpDown className="h-4 w-4" />
        </Button>

        {/* Show the raw displayValue string being built */}
        <div className="text-5xl font-bold break-all truncate">
          {formatForDisplay(displayValue)}
        </div>

        {/* Secondary display showing the conversion */}
        <div className="text-lg text-muted-foreground mt-1">
          {usdRate > 0
            ? inputMode === "usd"
              ? `≈ ${currentSatsValue.toLocaleString()} sats`
              : `≈ $${calculateUsdFromSats(currentSatsValue).toFixed(2)}`
            : "Enter Amount"}
        </div>

        {/* Add the Use Max button here */}
        {maxAmountSats && maxAmountSats > 0 && (
          <Button
            variant="link"
            size="sm"
            className="mt-1 h-auto p-0"
            onClick={() => {
              console.log(
                `[Use Max] Clicked. maxAmountSats prop: ${maxAmountSats}, current mode: ${inputMode}`
              );
              if (inputMode === "usd") {
                // If current mode is USD, switch to SATS mode first
                console.log(
                  "[Use Max] Mode is usd. Switching to sats mode first."
                );
                setInputMode("sats");
                // wait for the input mode to change
                setTimeout(() => {
                  setDisplayValue(maxAmountSats.toString());
                }, 100);
              }
              // Now, directly set the display value to the exact max sats amount
              const valueToSet = maxAmountSats.toString();
              console.log(
                `[Use Max] Setting displayValue to: "${valueToSet}\"`
              );
              setDisplayValue(valueToSet);
            }}
            disabled={isAtMaxAmount}>
            Use Max
          </Button>
        )}

        {isAtMaxAmount && (
          <div className="text-sm text-amber-500 mt-1">
            Maximum amount reached
          </div>
        )}

        {usdRate <= 0 && (
          <div className="text-sm text-red-500 mt-1">
            Invalid USD rate provided. Cannot calculate properly.
          </div>
        )}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-2 w-full max-w-xs">
        {keypadLayout.flat().map((key) => {
          // Disable number/decimal keys if max amount is reached
          const isDisabled = isAtMaxAmount && key !== "del";

          // Disable decimal key based on mode and current state
          const isDecimalDisabled =
            (key === "." && inputMode === "sats") || // No decimals in sats mode
            (key === "." && displayValue.includes(".")); // No duplicate decimals

          return (
            <Button
              key={key}
              variant="outline"
              className="h-16 text-2xl font-semibold"
              onClick={() => handleKeyPress(key)}
              disabled={isDisabled || isDecimalDisabled}>
              {key === "del" ? <Delete className="h-6 w-6" /> : key}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
