import {
  HiOutlineWallet,
  HiOutlineExclamationTriangle,
} from 'react-icons/hi2';
import { useMetaMask } from '../../hooks/useMetaMask';
import './MetaMaskButton.css';

export default function MetaMaskButton() {
  const {
    account,
    isConnected,
    isCorrectNetwork,
    isMetaMaskInstalled,
    isConnecting,
    connectWallet,
    switchToBscTestnet,
    disconnect,
  } = useMetaMask();

  if (!isMetaMaskInstalled) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noopener noreferrer"
        className="metamask-btn install"
        title="Install MetaMask"
      >
        <HiOutlineWallet /> Install MetaMask
      </a>
    );
  }

  if (!isConnected) {
    return (
      <button
        className="metamask-btn connect"
        onClick={connectWallet}
        disabled={isConnecting}
      >
        {isConnecting ? (
          <><span className="spinner" style={{ width: 14, height: 14 }} /> Connecting...</>
        ) : (
          <><HiOutlineWallet /> Connect MetaMask</>
        )}
      </button>
    );
  }

  if (!isCorrectNetwork) {
    return (
      <button className="metamask-btn wrong-network" onClick={switchToBscTestnet}>
        <HiOutlineExclamationTriangle /> Wrong Network
      </button>
    );
  }

  return (
    <button className="metamask-btn connected" onClick={disconnect} title="Disconnect">
      <span className="metamask-dot" />
      {account?.slice(0, 6)}...{account?.slice(-4)}
    </button>
  );
}
