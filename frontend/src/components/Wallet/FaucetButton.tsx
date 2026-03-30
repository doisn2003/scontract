import { useState } from 'react';
import { HiOutlineHandRaised } from 'react-icons/hi2';
import toast from 'react-hot-toast';
import api from '../../services/api';
import type { ApiResponse } from '../../types';

interface FaucetButtonProps {
  address: string;
  onSuccess?: () => void;
}

export default function FaucetButton({ address, onSuccess }: FaucetButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleFaucet = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.post<ApiResponse<any>>('/faucet', { targetAddress: address });
      if (data.success) {
        toast.success('Faucet request successful! Your tokens are on the way.');
        if (onSuccess) onSuccess();
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Faucet request failed';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      className="btn btn-primary btn-sm"
      onClick={handleFaucet}
      disabled={isLoading}
      title="Request test tokens (Faucet)"
    >
      {isLoading ? (
        <span className="spinner-sm" />
      ) : (
        <>
          <HiOutlineHandRaised />
          <span>Faucet</span>
        </>
      )}
    </button>
  );
}
