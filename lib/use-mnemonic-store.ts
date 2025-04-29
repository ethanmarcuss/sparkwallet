"use client";

import { decryptMnemonic, encryptMnemonic } from "@/lib/crypto";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Session {
  sessionKey: string | null;
  expiresAt: number | null;
}

interface MnemonicState {
  encryptedMnemonic: string | null;
  sessionEncryptedMnemonic: string | null;
  session: Session;
  saveEncryptedMnemonic: (mnemonic: string, password: string) => Promise<void>;
  getDecryptedMnemonic: (password: string) => Promise<string>;
  startSession: (password: string) => Promise<void>;
  endSession: () => void;
  getSessionMnemonic: () => Promise<string | null>;
  clearEncryptedMnemonic: () => void;
}

export const useMnemonicStore = create<MnemonicState>()(
  persist(
    (set, get) => ({
      encryptedMnemonic: null,
      sessionEncryptedMnemonic: null,
      session: {
        sessionKey: null,
        expiresAt: null,
      },

      saveEncryptedMnemonic: async (mnemonic: string, password: string) => {
        const encrypted = await encryptMnemonic(mnemonic, password);
        set({ encryptedMnemonic: encrypted });
      },

      getDecryptedMnemonic: async (password: string) => {
        const { encryptedMnemonic } = get();
        if (!encryptedMnemonic) {
          throw new Error("No encrypted mnemonic found");
        }
        return decryptMnemonic(encryptedMnemonic, password);
      },

      startSession: async (password: string) => {
        const mnemonic = await get().getDecryptedMnemonic(password);
        const sessionKey = crypto.randomUUID();
        const sessionEncryptedMnemonic = await encryptMnemonic(
          mnemonic,
          sessionKey
        );
        const expiresAt = Date.now() + 30 * 60 * 1000;
        set({
          sessionEncryptedMnemonic,
          session: {
            sessionKey,
            expiresAt,
          },
        });
      },

      getSessionMnemonic: async () => {
        const { session, sessionEncryptedMnemonic } = get();
        if (
          session.sessionKey &&
          session.expiresAt &&
          Date.now() < session.expiresAt &&
          sessionEncryptedMnemonic
        ) {
          return decryptMnemonic(sessionEncryptedMnemonic, session.sessionKey);
        }
        return null;
      },

      endSession: () => {
        set({
          session: {
            sessionKey: null,
            expiresAt: null,
          },
          sessionEncryptedMnemonic: null,
        });
      },

      clearEncryptedMnemonic: () => {
        set({
          encryptedMnemonic: null,
          sessionEncryptedMnemonic: null,
          session: {
            sessionKey: null,
            expiresAt: null,
          },
        });
      },
    }),
    {
      name: "mnemonic-storage",
    }
  )
);
