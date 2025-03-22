import { useState, useContext, type ChangeEvent } from 'react';
import { Collapse, Button, Card, Form, Alert, Spinner, InputGroup } from 'react-bootstrap';
import { ChevronDown, ChevronUp } from 'react-bootstrap-icons';
import { AztecContext, AztecEnv } from '../aztecEnv';
import { getInitialTestAccounts } from '@aztec/accounts/testing/lazy';
import { getSchnorrAccount } from '@aztec/accounts/schnorr/lazy';
import type { InterfaceProps } from '../types';

export const EnvironmentCard = ({ client }: InterfaceProps) => {
  const [openEnv, setOpenEnv] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [envError, setEnvError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<{ address: string }[]>([]);
  const { pxe, setPXE, setNodeURL, setAztecNode, setPXEInitialized, setLogs, wallet, setWallet, selectedAccount, setSelectedAccount } = useContext(AztecContext);

  const connectToSandbox = async () => {
    setConnecting(true);
    setEnvError(null);
    try {
      await AztecEnv.initNetworkStore();
      const nodeURL = 'http://localhost:8080';
      const aztecNode = await AztecEnv.connectToNode(nodeURL);
      setAztecNode(aztecNode);
      setNodeURL(nodeURL);
      const pxeInstance = await AztecEnv.initPXE(aztecNode, setLogs);
      setPXE(pxeInstance);
      setPXEInitialized(true);
      setIsConnected(true);

      const testAccounts = await getInitialTestAccounts();
      const accountWallets = [];
      for (const account of testAccounts) {
        const accountManager = await getSchnorrAccount(pxeInstance, account.secret, account.signingKey, account.salt);
        await accountManager.register();
        const walletInstance = await accountManager.getWallet();
        const address = walletInstance.getAddress().toString();
        accountWallets.push({ address, walletInstance });
      }
      setAccounts(accountWallets.map(({ address }) => ({ address })));
      setSelectedAccount(accountWallets[0].address); // 초기 계정 설정
      setWallet(accountWallets[0].walletInstance);
    } catch (err) {
      console.error(err);
      setEnvError('Could not connect to the Aztec Sandbox. Is the Sandbox running?');
    } finally {
      setConnecting(false);
    }
  };

  const handleAccountChange = (e: { target: { value: React.SetStateAction<string> } }) => {
    setSelectedAccount(e.target.value as any);
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

            {envError && <Alert variant="danger" className="mt-2">{envError}</Alert>}

            {accounts.length > 0 && (
              <Form.Group className="mt-3">
                <Form.Label>Sandbox Accounts</Form.Label>
                <InputGroup>
                  <Form.Control as="select"
                    className="custom-select"
                    value={selectedAccount}
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