import { useState, useContext, useEffect } from 'react';
import { Collapse, Button, Card, Form, Alert, Spinner, InputGroup, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { ChevronDown, ChevronUp, Copy } from 'react-bootstrap-icons';
import { AztecContext, AztecEnv } from '../aztecEnv';
import type { InterfaceProps } from '../types';
import type { AccountWalletWithSecretKey, AztecNode, PXE } from '@aztec/aztec.js';
import { copyToClipboard } from '../utils/clipboard';

export const EnvironmentCard = ({ client }: InterfaceProps) => {
  const [openEnv, setOpenEnv] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [envError, setEnvError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<
    { address: string; walletInstance: AccountWalletWithSecretKey }[]
  >([]);
  const { pxe, setPXE, setNodeURL, setAztecNode, setPXEInitialized, wallet, setWallet } = useContext(AztecContext);
  const [selectedAddress, setSelectedAddress] = useState<string>('');

  useEffect(() => {
    if (wallet) {
      const address = wallet.getAddress().toString();
      setSelectedAddress(address);
    }
  }, [wallet]);

  const connectToSandbox = async () => {
    if (connecting || isConnected) return;
    setConnecting(true);
    setEnvError(null);
  
    const nodeURL = 'http://localhost:8080';
  
    const timeout = (ms: number) =>
      new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), ms));
  
    try {
      const aztecNode = await Promise.race([
        AztecEnv.connectToNode(nodeURL),
        timeout(5000),
      ]) as AztecNode;
  
      setAztecNode(aztecNode);
      setNodeURL(nodeURL);
  
      const pxeInstance = await Promise.race([
        AztecEnv.initPXE(nodeURL),
        timeout(5000),
      ]) as PXE;
  
      setPXE(pxeInstance);
  
      const wallets = await AztecEnv.getInitialWallets(pxeInstance);
      const accountWallets = wallets.map((wallet) => ({
        address: wallet.getAddress().toString(),
        walletInstance: wallet,
      }));
  
      setAccounts(accountWallets);
      setSelectedAddress(accountWallets[0].address);
      setWallet(accountWallets[0].walletInstance);
      setPXEInitialized(true);
      setIsConnected(true);
    } catch (err: any) {
      console.error(err);
      setEnvError('❌ Could not connect to the Aztec Sandbox. Is it running on http://localhost:8080?');
    } finally {
      setConnecting(false);
    }
  };
  

  const handleAccountChange = (e: React.ChangeEvent<any>) => {
    const selectedAddress = (e.target as HTMLSelectElement).value;
    setSelectedAddress(selectedAddress);
    const selected = accounts.find(acc => acc.address === selectedAddress);
    if (selected) {
      setWallet(selected.walletInstance);
    }
  };

  return (
    <Card className="mb-3">
      <Card.Header
        onClick={() => setOpenEnv(!openEnv)}
        aria-controls="env-collapse"
        aria-expanded={openEnv}
        className="d-flex align-items-center justify-content-between"
        style={{ cursor: 'pointer' }}
      >
        Environment
        {openEnv ? <ChevronUp /> : <ChevronDown />}
      </Card.Header>
      <Collapse in={openEnv}>
        <div id="env-collapse">
          <Card.Body>
            <p style={{ fontSize: '0.85rem', color: '#6c757d' }}>
              Currently, only Aztec Sandbox is supported.{' '}
              <a href="https://docs.aztec.network/developers/getting_started#install-and-run-the-sandbox" target="_blank" rel="noopener noreferrer">
                Learn more
              </a>
            </p>
            <p style={{ fontSize: '0.8rem' }}>
              🛠️ Using compiler version <strong>0.84.0</strong>
            </p>
            <Button
              variant={pxe ? 'success' : 'primary'}
              className="w-100 mb-2"
              onClick={connectToSandbox}
              disabled={connecting || isConnected}
            >
              {connecting ? (
                <>
                  <Spinner animation="border" size="sm" /> Connecting...
                </>
              ) : isConnected ? (
                '✅ Connected'
              ) : (
                'Connect to Aztec Sandbox'
              )}
            </Button>

            {envError && <Alert variant="danger" className="mt-2" style={{
                            fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                            fontSize: '12px',
                        }}>{envError}</Alert>}

            {accounts.length > 0 && (
              <Form.Group className="mt-3">
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <Form.Label className="mb-0">Sandbox Accounts</Form.Label>
                  {selectedAddress && (
                    <OverlayTrigger placement="top" overlay={<Tooltip>Copy Address</Tooltip>}>
                      <span style={{ cursor: 'pointer' }} onClick={() => copyToClipboard(selectedAddress)}>
                      <Copy />
                      </span>
                    </OverlayTrigger>
                  )}
                </div>
                <InputGroup>
                  <Form.Control
                    as="select"
                    className="custom-select"
                    value={selectedAddress}
                    onChange={handleAccountChange}
                    style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {accounts.map((acc, idx) => (
                      <option key={acc.address} value={acc.address}>
                        {`Account ${idx + 1}: ${acc.address.slice(0, 6)}...${acc.address.slice(-4)}`}
                      </option>
                    ))}
                  </Form.Control>
                </InputGroup>
              </Form.Group>
            )}
          </Card.Body>
        </div>
      </Collapse>
    </Card>
  );
};
