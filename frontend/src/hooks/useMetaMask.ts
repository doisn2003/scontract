/**
 * useMetaMask.ts
 * Custom hook for MetaMask wallet connection, network switching, and provider access.
 */

import { useState, useEffect, useCallback } from 'react';

declare global {
  interface Window {
    ethereum?: any;
  }
}

const BSC_TESTNET_CHAIN_ID = 97;
const BSC_TESTNET_CHAIN_ID_HEX = '0x61';

const BSC_TESTNET_NETWORK = {
  chainId: BSC_TESTNET_CHAIN_ID_HEX,
  chainName: 'BNB Smart Chain Testnet',
  nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
  rpcUrls: ['https://data-seed-prebsc-1-s1.bnbchain.org:8545/'],
  blockExplorerUrls: ['https://testnet.bscscan.com/'],
};

interface MetaMaskState {
  account: string | null;
  chainId: number | null;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  isMetaMaskInstalled: boolean;
  isConnecting: boolean;
  error: string | null;
}

export function useMetaMask() {
  const [state, setState] = useState<MetaMaskState>({
    account: null,
    chainId: null,
    isConnected: false,
    isCorrectNetwork: false,
    isMetaMaskInstalled: typeof window !== 'undefined' && !!window.ethereum,
    isConnecting: false,
    error: null,
  });

  // Check current accounts & chain on mount
  useEffect(() => {
    const ethereum = window.ethereum;
    if (!ethereum) return;

    const checkConnection = async () => {
      try {
        const accounts = await ethereum.request({ method: 'eth_accounts' });
        const chainIdHex = await ethereum.request({ method: 'eth_chainId' });
        const chainId = parseInt(chainIdHex, 16);

        if (accounts.length > 0) {
          setState(s => ({
            ...s,
            account: accounts[0],
            chainId,
            isConnected: true,
            isCorrectNetwork: chainId === BSC_TESTNET_CHAIN_ID,
          }));
        }
      } catch {
        // silent
      }
    };

    checkConnection();

    // Listen for changes
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setState(s => ({ ...s, account: null, isConnected: false }));
      } else {
        setState(s => ({ ...s, account: accounts[0], isConnected: true }));
      }
    };

    const handleChainChanged = (chainIdHex: string) => {
      const chainId = parseInt(chainIdHex, 16);
      setState(s => ({
        ...s,
        chainId,
        isCorrectNetwork: chainId === BSC_TESTNET_CHAIN_ID,
      }));
    };

    ethereum.on('accountsChanged', handleAccountsChanged);
    ethereum.on('chainChanged', handleChainChanged);

    return () => {
      ethereum.removeListener('accountsChanged', handleAccountsChanged);
      ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, []);

  const connectWallet = useCallback(async () => {
    const ethereum = window.ethereum;
    if (!ethereum) {
      setState(s => ({ ...s, error: 'MetaMask is not installed' }));
      return;
    }

    setState(s => ({ ...s, isConnecting: true, error: null }));
    try {
      await ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      });
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      const chainIdHex = await ethereum.request({ method: 'eth_chainId' });
      const chainId = parseInt(chainIdHex, 16);

      setState(s => ({
        ...s,
        account: accounts[0],
        chainId,
        isConnected: true,
        isCorrectNetwork: chainId === BSC_TESTNET_CHAIN_ID,
        isConnecting: false,
      }));
    } catch (err: any) {
      setState(s => ({
        ...s,
        isConnecting: false,
        error: err.message || 'Failed to connect',
      }));
    }
  }, []);

  const switchToBscTestnet = useCallback(async () => {
    const ethereum = window.ethereum;
    if (!ethereum) return;

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BSC_TESTNET_CHAIN_ID_HEX }],
      });
    } catch (switchError: any) {
      // Chain not added yet — try adding it
      if (switchError.code === 4902) {
        try {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [BSC_TESTNET_NETWORK],
          });
        } catch {
          setState(s => ({ ...s, error: 'Failed to add BSC Testnet to MetaMask' }));
        }
      } else {
        setState(s => ({ ...s, error: switchError.message }));
      }
    }
  }, []);

  const disconnect = useCallback(() => {
    setState(s => ({
      ...s,
      account: null,
      chainId: null,
      isConnected: false,
      isCorrectNetwork: false,
    }));
  }, []);

  return {
    ...state,
    connectWallet,
    switchToBscTestnet,
    disconnect,
  };
}
