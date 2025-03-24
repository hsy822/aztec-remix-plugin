import React, { useState } from 'react';
import { AztecContext } from './aztecEnv'; 
     
export const AztecProvider = ({ children }: { children: React.ReactNode }) => {
  const [pxe, setPXE] = useState(null);
  const [nodeURL, setNodeURL] = useState('');
  const [node, setAztecNode] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [isPXEInitialized, setPXEInitialized] = useState(false);
  const [walletDB, setWalletDB] = useState(null);
  const [currentContract, setCurrentContract] = useState(null);
  const [currentContractAddress, setCurrentContractAddress] = useState(null);
  const [currentTx, setCurrentTx] = useState(null);
  const [targetProject, setTargetProject] = useState<string | null>(null);

  return (
    <AztecContext.Provider
      value={{
        pxe,
        setPXE,
        nodeURL,
        setNodeURL,
        node,
        setAztecNode,
        wallet,
        setWallet,
        isPXEInitialized,
        setPXEInitialized,
        walletDB,
        setWalletDB,
        currentContract,
        setCurrentContract,
        currentContractAddress,
        setCurrentContractAddress,
        currentTx,
        setCurrentTx,
        targetProject,
        setTargetProject,
      }}
    >
      {children}
    </AztecContext.Provider>
  );
};
