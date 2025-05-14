"use client";
import { SparkWallet } from "@buildonspark/spark-sdk";
import {
  ExitSpeed,
  type LightningReceiveRequest,
  type Transfer,
} from "@buildonspark/spark-sdk/types";
import type { NetworkType } from "@buildonspark/spark-sdk/utils";
import { getLatestDepositTxId } from "@buildonspark/spark-sdk/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  type Currency,
  DEFAULT_BTC_CURRENCY,
  DEFAULT_USD_CURRENCY,
  PERMANENT_CURRENCIES,
  getCurrency,
} from "../types/currency";
import { useMnemonicStore } from "@/lib/use-mnemonic-store";
import { toast } from "sonner";
import { useEffect } from "react";

// Add a status type
type InitializationStatus =
  | "idle" // Not started
  | "loading" // Trying to initialize
  | "success" // Wallet is ready
  | "needs_password" // Mnemonic exists, but session invalid/missing
  | "no_wallet" // No mnemonic found during load attempt
  | "error"; // General error during init

const DEFAULT_NETWORK: NetworkType = "MAINNET";
const STORAGE_KEY = "flashnet_token";

interface WalletState {
  wallet?: SparkWallet;
  sparkAddress: string;
  pubkey: string;
  initWalletNetwork: NetworkType;
  mnemonic: string | null;
  activeInputCurrency: Currency;
  activeAsset: Currency;
  assets: Map<string, Currency>;
  isInitialized: boolean;
  initializationStatus: InitializationStatus;
  initializationError: string | null;
  onchainDepositAddresses: Set<string>;
  btcBalance: number | undefined;
  tokenBalances: Map<string, { balance: bigint }>;
}

interface QueryTransfersResponse {
  transfers: Transfer[];
  offset: number;
}

interface WalletActions {
  initWallet: (mnemonic: string) => Promise<void>;
  initWalletFromSeed: (seed: string) => Promise<void>;
  setInitWalletNetwork: (network: NetworkType) => void;
  setWallet: (wallet: SparkWallet) => void;
  setSparkAddress: (sparkAddress: string) => void;
  setPubkey: (pubkey: string) => void;
  getMasterPublicKey: () => Promise<string>;
  getAllTransfers: (
    limit: number,
    offset: number
  ) => Promise<QueryTransfersResponse>;
  getBitcoinDepositAddress: () => Promise<string>;
  createLightningInvoice: (
    amount: number,
    memo: string
  ) => Promise<LightningReceiveRequest>;
  sendTransfer: (amount: number, recipient: string) => Promise<void>;
  payLightningInvoice: (invoice: string) => Promise<void>;
  transferTokens: (
    tokenPublicKey: string,
    tokenAmount: bigint,
    receiverSparkAddress: string
  ) => Promise<void>;
  setActiveAsset: (asset: Currency) => void;
  updateAssets: (assets: Map<string, Currency>) => void;
  setActiveInputCurrency: (currency: Currency) => void;
  withdrawOnchain: (address: string, amount: number) => Promise<void>;
  loadStoredWallet: () => Promise<InitializationStatus>;
  resetWallet: () => void;
  setOnchainDepositAddresses: (addresses: Set<string>) => void;
  setInitializationStatus: (
    status: InitializationStatus,
    error?: string | null
  ) => void;
  getInvoiceFeeEstimate: (invoice: string) => Promise<number>;
  setBalance: (
    balance: number,
    tokenBalances: Map<string, { balance: bigint }>
  ) => void;
}

type WalletStore = WalletState & WalletActions;

const MNEMONIC_STORAGE_KEY = "spark_wallet_mnemonic";
const SEED_STORAGE_KEY = "spark_wallet_seed";

const useWalletStore = create<WalletStore>()(
  devtools(
    (set, get) => ({
      // State Properties
      wallet: undefined,
      sparkAddress: "",
      pubkey: "",
      initWalletNetwork: DEFAULT_NETWORK,
      mnemonic: null,
      activeInputCurrency: getCurrency(
        PERMANENT_CURRENCIES,
        "USD",
        DEFAULT_USD_CURRENCY
      ),
      activeAsset: getCurrency(
        PERMANENT_CURRENCIES,
        "BTC",
        DEFAULT_BTC_CURRENCY
      ),
      assets: PERMANENT_CURRENCIES,
      isInitialized: false,
      initializationStatus: "idle",
      initializationError: null,
      onchainDepositAddresses: new Set(),
      btcBalance: undefined,
      tokenBalances: new Map(),

      // Actions
      setInitWalletNetwork: (network: NetworkType) => {
        set({ initWalletNetwork: network });
      },
      setWallet: (wallet: SparkWallet) => {
        set({ wallet, isInitialized: !!wallet });
      },
      setSparkAddress: (sparkAddress: string) => {
        set({ sparkAddress });
      },
      setPubkey: (pubkey: string) => {
        set({ pubkey });
      },
      setActiveInputCurrency: (currency: Currency) => {
        set({ activeInputCurrency: currency });
      },
      setActiveAsset: (asset: Currency) => {
        set({ activeAsset: asset });
      },
      updateAssets: (newAssets: Map<string, Currency>) => {
        const currentAssets = get().assets;
        newAssets.forEach((value, key) => {
          currentAssets.set(key, value);
        });
        set({ assets: currentAssets });
      },
      setInitializationStatus: (
        status: InitializationStatus,
        error: string | null = null
      ) => {
        set({
          initializationStatus: status,
          isInitialized: status === "success",
          initializationError: error,
        });
      },
      setBalance: (
        balance: number,
        tokenBalances: Map<string, { balance: bigint }>
      ) => {
        set({ btcBalance: balance, tokenBalances: tokenBalances });
      },
      resetWallet: () => {
        set({
          wallet: undefined,
          sparkAddress: "",
          pubkey: "",
          mnemonic: null,
          isInitialized: false,
          initializationStatus: "idle",
          initializationError: null,
          activeInputCurrency: getCurrency(
            PERMANENT_CURRENCIES,
            "USD",
            DEFAULT_USD_CURRENCY
          ),
          activeAsset: getCurrency(
            PERMANENT_CURRENCIES,
            "BTC",
            DEFAULT_BTC_CURRENCY
          ),
          assets: PERMANENT_CURRENCIES,
          onchainDepositAddresses: new Set(),
          btcBalance: undefined,
          tokenBalances: new Map(),
        });
        sessionStorage.removeItem(MNEMONIC_STORAGE_KEY);
        sessionStorage.removeItem(SEED_STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_KEY);
      },
      setOnchainDepositAddresses: (addresses: Set<string>) => {
        set({ onchainDepositAddresses: addresses });
      },

      // Wallet Operations
      initWallet: async (mnemonic: string) => {
        const {
          initWalletNetwork,
          setSparkAddress,
          setPubkey,
          setOnchainDepositAddresses,
          setInitializationStatus,
        } = get();
        try {
          console.log("initWallet: Initializing...");
          const { wallet } = await SparkWallet.initialize({
            mnemonicOrSeed: mnemonic,
            options: {
              network: initWalletNetwork,
            },
          });
          set({ wallet });
          setSparkAddress(await wallet.getSparkAddress());
          setPubkey(await wallet.getIdentityPublicKey());
          setOnchainDepositAddresses(
            new Set(await wallet.getUnusedDepositAddresses())
          );
          sessionStorage.setItem(MNEMONIC_STORAGE_KEY, mnemonic);
          set({ mnemonic });
          console.log("initWallet: Success.");
          setInitializationStatus("success");
        } catch (error) {
          console.error("initWallet: Failed.", error);
          setInitializationStatus(
            "error",
            error instanceof Error ? error.message : "Initialization failed"
          );
        }
      },
      initWalletFromSeed: async (seed: string) => {
        const {
          initWalletNetwork,
          setSparkAddress,
          setPubkey,
          setOnchainDepositAddresses,
          setInitializationStatus,
        } = get();
        try {
          console.log("initWalletFromSeed: Initializing...");
          const { wallet } = await SparkWallet.initialize({
            mnemonicOrSeed: seed,
            options: {
              network: initWalletNetwork,
            },
          });
          set({ wallet });
          setSparkAddress(await wallet.getSparkAddress());
          setPubkey(await wallet.getIdentityPublicKey());
          setOnchainDepositAddresses(
            new Set(await wallet.getUnusedDepositAddresses())
          );
          sessionStorage.setItem(SEED_STORAGE_KEY, seed);
          console.log("initWalletFromSeed: Success.");
          setInitializationStatus("success");
        } catch (error) {
          console.error("initWalletFromSeed: Failed.", error);
          setInitializationStatus(
            "error",
            error instanceof Error
              ? error.message
              : "Initialization from seed failed"
          );
        }
      },
      loadStoredWallet: async (): Promise<InitializationStatus> => {
        const { setInitializationStatus, initializationStatus } = get();

        // Allow re-running if idle OR if we are specifically in the needs_password state
        // (triggered by unlock page after starting a session)
        if (
          initializationStatus !== "idle" &&
          initializationStatus !== "needs_password"
        ) {
          console.log(
            "loadStoredWallet: Skipping - already initialized or in non-recoverable state. Status:",
            initializationStatus
          );
          return initializationStatus;
        }

        // Only set to loading if we weren't already in 'needs_password'
        if (initializationStatus === "idle") {
          setInitializationStatus("loading");
        }
        console.log("loadStoredWallet: Attempting to load...");

        // Check for session stored mnemonic first
        const sessionMnemonic = sessionStorage.getItem(MNEMONIC_STORAGE_KEY);
        // Try to get mnemonic from mnemonic store's session
        const storedSeed = sessionStorage.getItem(SEED_STORAGE_KEY);

        // Check if we have an encrypted mnemonic in persistent storage
        // by importing from the mnemonic store
        const { getSessionMnemonic } = await import(
          "@/lib/use-mnemonic-store"
        ).then((module) => module.useMnemonicStore.getState());

        try {
          // First try session mnemonic (fastest, already decrypted)
          if (sessionMnemonic) {
            console.log("loadStoredWallet: Found valid session mnemonic.");
            await get().initWallet(sessionMnemonic);
          }
          // Next try session seed
          else if (storedSeed) {
            console.log("loadStoredWallet: Found stored seed (no session).");
            await get().initWalletFromSeed(storedSeed);
          }
          // Then try to get mnemonic from session in the mnemonic store
          else {
            const sessionMnemonicFromStore = await getSessionMnemonic();
            if (sessionMnemonicFromStore) {
              console.log(
                "loadStoredWallet: Found session mnemonic from mnemonic store."
              );
              await get().initWallet(sessionMnemonicFromStore);
            }
            // Check if we have an encrypted mnemonic that needs a password
            else {
              const encryptedMnemonic =
                useMnemonicStore.getState().encryptedMnemonic;
              if (encryptedMnemonic) {
                console.log(
                  "loadStoredWallet: Encrypted mnemonic found, but no session. Needs password."
                );
                setInitializationStatus("needs_password");
              } else {
                console.log(
                  "loadStoredWallet: No stored mnemonic or seed found."
                );
                setInitializationStatus("no_wallet");
              }
            }
          }
        } catch (error) {
          console.error(
            "loadStoredWallet: Error during initialization.",
            error
          );
          if (get().initializationStatus !== "error") {
            setInitializationStatus(
              "error",
              error instanceof Error ? error.message : "Loading failed"
            );
          }
        }
        return get().initializationStatus;
      },
      getMasterPublicKey: async () => {
        const { wallet } = get();
        if (!wallet) {
          throw new Error("Wallet not initialized");
        }
        return await wallet.getIdentityPublicKey();
      },
      getAllTransfers: async (limit: number, offset: number) => {
        const { wallet } = get();
        if (!wallet) {
          throw new Error("Wallet not initialized");
        }
        return await wallet.getTransfers(limit, offset);
      },
      getBitcoinDepositAddress: async () => {
        const { wallet, onchainDepositAddresses } = get();
        if (!wallet) {
          throw new Error("Wallet not initialized");
        }
        const btcDepositAddress = await wallet.getSingleUseDepositAddress();
        set({
          onchainDepositAddresses: new Set([
            btcDepositAddress,
            ...Array.from(onchainDepositAddresses),
          ]),
        });
        if (!btcDepositAddress) {
          throw new Error("Failed to generate deposit address");
        }
        return btcDepositAddress;
      },
      sendTransfer: async (amountSats: number, recipient: string) => {
        const { wallet } = get();
        if (!wallet) {
          throw new Error("Wallet not initialized");
        }
        await wallet.transfer({
          amountSats: amountSats,
          receiverSparkAddress: recipient,
        });
      },
      createLightningInvoice: async (amountSats: number, memo: string) => {
        const { wallet } = get();
        if (!wallet) {
          throw new Error("Wallet not initialized");
        }
        const invoice = await wallet.createLightningInvoice({
          amountSats,
          memo,
        });
        return invoice;
      },
      payLightningInvoice: async (invoice: string) => {
        const { wallet } = get();
        if (!wallet) {
          throw new Error("Wallet not initialized");
        }
        const feeEstimate = await wallet.getLightningSendFeeEstimate({
          encodedInvoice: invoice,
        });
        console.log("payLightningInvoice: Fee estimate:", feeEstimate);
        await wallet.payLightningInvoice({
          invoice,
          maxFeeSats: feeEstimate + 100,
        });
      },
      transferTokens: async (
        tokenPublicKey: string,
        tokenAmount: bigint,
        receiverSparkAddress: string
      ) => {
        const { wallet } = get();
        if (!wallet) {
          throw new Error("Wallet not initialized");
        }
        await wallet.transferTokens({
          tokenPublicKey,
          tokenAmount,
          receiverSparkAddress: receiverSparkAddress,
        });
      },
      withdrawOnchain: async (address: string, amount: number) => {
        const { wallet } = get();
        if (!wallet) {
          throw new Error("Wallet not initialized");
        }
        await wallet.withdraw({
          onchainAddress: address,
          exitSpeed: ExitSpeed.MEDIUM,
          amountSats: amount,
        });
      },
      getInvoiceFeeEstimate: async (invoice: string) => {
        const { wallet } = get();
        if (!wallet) {
          throw new Error("Wallet not initialized");
        }
        const feeEstimate = await wallet.getLightningSendFeeEstimate({
          encodedInvoice: invoice,
        });
        return feeEstimate;
      },
    }),
    {
      name: "wallet-store",
      enabled: process.env.NODE_ENV === "development",
    }
  )
);

export function useWallet() {
  // Select each property individually to avoid creating new objects
  const wallet = useWalletStore((state) => state.wallet);
  const isInitialized = useWalletStore((state) => state.isInitialized);
  const initializationStatus = useWalletStore(
    (state) => state.initializationStatus
  );
  const initializationError = useWalletStore(
    (state) => state.initializationError
  );
  const activeInputCurrency = useWalletStore(
    (state) => state.activeInputCurrency
  );
  const assets = useWalletStore((state) => state.assets);
  const activeAsset = useWalletStore((state) => state.activeAsset);
  const initWalletNetwork = useWalletStore((state) => state.initWalletNetwork);
  const sparkAddress = useWalletStore((state) => state.sparkAddress);
  const pubkey = useWalletStore((state) => state.pubkey);
  const onchainDepositAddresses = useWalletStore(
    (state) => state.onchainDepositAddresses
  );

  // Actions
  const {
    setActiveInputCurrency,
    setActiveAsset,
    updateAssets,
    setInitWalletNetwork,
    getMasterPublicKey,
    getAllTransfers,
    getBitcoinDepositAddress,
    createLightningInvoice,
    sendTransfer,
    payLightningInvoice,
    transferTokens,
    withdrawOnchain,
    resetWallet,
    initWallet,
    initWalletFromSeed,
    loadStoredWallet,
    setOnchainDepositAddresses,
    getInvoiceFeeEstimate,
  } = useWalletStore();

  const queryClient = useQueryClient();

  // Track previous balance to detect increases
  // const [previousBalance, setPreviousBalance] = useState<number>(0);

  // Select balance state directly from the store
  const btcBalanceValue = useWalletStore((state) => state.btcBalance);
  const tokenBalancesValue = useWalletStore((state) => state.tokenBalances);
  const setBalance = useWalletStore((state) => state.setBalance);

  const initQuery = useQuery({
    queryKey: ["wallet", "init"],
    queryFn: async () => {
      return await loadStoredWallet();
    },
    enabled: initializationStatus === "idle",
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    staleTime: Infinity,
  });

  // Re-added L1 Deposit Polling Query
  useQuery({
    queryKey: ["wallet", "l1Deposit"],
    queryFn: async () => {
      if (!wallet) {
        console.log("l1Deposit check skipped: Wallet not ready.");
        return null;
      }
      console.log("l1Deposit check running...");
      const unClaimedAddresses: Set<string> = new Set(
        Array.from(onchainDepositAddresses)
      );
      let claimedSomething = false;
      await Promise.all(
        Array.from(onchainDepositAddresses).map(async (addr) => {
          const latestDepositTxId = await getLatestDepositTxId(addr);
          if (latestDepositTxId) {
            try {
              console.log(
                `Attempting to claim deposit ${latestDepositTxId} for address ${addr}`
              );
              await wallet.claimDeposit(latestDepositTxId);
              unClaimedAddresses.delete(addr);
              claimedSomething = true;
              console.log(`Successfully claimed deposit ${latestDepositTxId}`);
            } catch (e) {
              console.error(
                `Error claiming deposit ${latestDepositTxId} for ${addr}:`,
                e
              );
            }
          }
        })
      );

      if (
        claimedSomething ||
        onchainDepositAddresses.size !== unClaimedAddresses.size
      ) {
        setOnchainDepositAddresses(unClaimedAddresses);
        // We no longer invalidate the balance query here, as balance is updated via events
        // queryClient.invalidateQueries({ queryKey: ["wallet", "balance"] });
        console.log("l1Deposit check: Addresses updated.");
      } else {
        console.log("l1Deposit check: No deposits found or claimed.");
      }

      // NOTE: If a claim happens, the 'deposit:confirmed' event should trigger
      // a balance update shortly after, handled by the useEffect below.
      // This query's primary role now is to trigger claims.
      return claimedSomething;
    },
    enabled: initializationStatus === "success",
    refetchOnMount: true,
    staleTime: 55000,
    refetchInterval: 60000,
  });

  // Effect for handling balance updates via event listeners
  useEffect(() => {
    if (!wallet || initializationStatus !== "success") {
      return; // Wallet not ready or not successfully initialized
    }

    let isMounted = true; // Track component mount status

    const handleBalanceUpdate = async (
      eventType: string,
      eventId: string | null,
      balanceFromEvent?: number
    ) => {
      console.log(
        `handleBalanceUpdate triggered by ${eventType}:`,
        eventId ?? "initial fetch"
      );
      if (!isMounted || !wallet) return; // Check mount status and wallet again

      try {
        // Get previous balance *before* fetching new one
        // Use getState to ensure we get the absolute latest value before the async operation
        const previousBtcBalance = useWalletStore.getState().btcBalance;

        // Fetch the latest balance from the SDK
        const currentBalance = await wallet.getBalance();
        if (!isMounted) return; // Check again after await

        const newBtcBalance = Number(currentBalance?.balance ?? 0);
        const newTokenBalances = (currentBalance?.tokenBalances ??
          new Map()) as Map<string, { balance: bigint }>;

        // Update the store state
        setBalance(newBtcBalance, newTokenBalances);
        console.log("Balance updated in store via event:", {
          btc: newBtcBalance,
          tokens: newTokenBalances,
        });

        // Show toast notification if BTC balance increased
        if (
          previousBtcBalance !== undefined &&
          newBtcBalance > previousBtcBalance
        ) {
          const increasedAmount = newBtcBalance - previousBtcBalance;
          toast.success("Funds Received", {
            description: `Received ${increasedAmount.toLocaleString()} sats`,
          });

          // Invalidate transaction list to refresh
          queryClient.invalidateQueries({
            queryKey: ["transactions", sparkAddress],
          });

          console.log(
            `Funds received toast shown for ${increasedAmount} sats.`
          );
        } else {
          console.log("Balance checked, no increase detected or first fetch.", {
            previous: previousBtcBalance,
            current: newBtcBalance,
          });
        }

        // Optional: Log balance mismatch warning
        if (
          balanceFromEvent !== undefined &&
          newBtcBalance !== balanceFromEvent
        ) {
          console.warn(
            `Balance mismatch for ${eventType} (${eventId}): Event reported ${balanceFromEvent}, but getBalance() returned ${newBtcBalance}`
          );
        }
      } catch (error) {
        if (isMounted) {
          console.error("Error fetching/updating balance after event:", error);
          // Optionally, update some error state in the store here
        }
      }
    };

    // Wrapper handlers for specific events
    const handleClaimed = (transferId: string, balance: number) => {
      handleBalanceUpdate("transfer:claimed", transferId, balance);
    };

    const handleConfirmed = (depositId: string, balance: number) => {
      handleBalanceUpdate("deposit:confirmed", depositId, balance);
    };

    // Register event listeners
    console.log("Registering balance event listeners...");
    wallet.on("transfer:claimed", handleClaimed);
    wallet.on("deposit:confirmed", handleConfirmed);

    // Fetch initial balance immediately after setting up listeners
    handleBalanceUpdate("initial fetch", null);

    // Cleanup function
    return () => {
      isMounted = false; // Mark as unmounted
      console.log("Cleaning up balance event listeners...");
      if (wallet) {
        // Ensure wallet still exists for cleanup
        wallet.off("transfer:claimed", handleClaimed);
        wallet.off("deposit:confirmed", handleConfirmed);
      }
    };
  }, [wallet, initializationStatus, queryClient, setBalance]); // Dependencies

  const satsUsdPriceQuery = useQuery({
    queryKey: ["satsUsdPrice"],
    queryFn: async () => {
      try {
        const response = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
        );
        if (!response.ok) {
          throw new Error(
            `Failed to fetch BTC price. status: ${response.status}`
          );
        }
        const data = await response.json();
        if (!data?.bitcoin?.usd) throw new Error("Invalid response format");
        return data.bitcoin.usd / 100_000_000;
      } catch (error) {
        console.error("Failed to fetch Sats/USD price:", error);
        return 0.0007;
      }
    },
    refetchInterval: 60000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 55000,
  });

  return {
    wallet,
    isInitialized,
    initializationStatus,
    initializationError,
    activeInputCurrency,
    assets,
    activeAsset,
    initWalletNetwork,
    sparkAddress,
    pubkey,
    onchainDepositAddresses,
    setActiveInputCurrency,
    setActiveAsset,
    updateAssets,
    setInitWalletNetwork,
    getMasterPublicKey,
    getAllTransfers,
    getBitcoinDepositAddress,
    createLightningInvoice,
    sendTransfer,
    payLightningInvoice,
    transferTokens,
    withdrawOnchain,
    resetWallet,
    initWallet,
    initWalletFromSeed,
    loadStoredWallet,
    getInvoiceFeeEstimate,
    btcBalance: {
      value: btcBalanceValue ?? 0,
      isLoading:
        initializationStatus === "loading" ||
        (initializationStatus === "success" && btcBalanceValue === undefined),
      error: null,
    },
    tokenBalances: {
      value: tokenBalancesValue ?? new Map(),
      isLoading:
        initializationStatus === "loading" ||
        (initializationStatus === "success" &&
          tokenBalancesValue === undefined),
      error: null,
    },
    satsUsdPrice: {
      value: satsUsdPriceQuery.data ?? 0.0007,
      isLoading: satsUsdPriceQuery.isLoading,
      error: satsUsdPriceQuery.error,
    },
    isInitializing: initializationStatus === "loading",
  };
}

export default useWalletStore;
