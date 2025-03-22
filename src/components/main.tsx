import { useContext, useEffect, useState } from 'react';
import { Collapse, Button, Card, Form, Alert, Spinner, InputGroup } from 'react-bootstrap';
import { ChevronDown, ChevronUp } from 'react-bootstrap-icons';
import type { Client } from '@remixproject/plugin';
import type { Api } from '@remixproject/plugin-utils';
import type { IRemixApi } from '@remixproject/plugin-api';
import { AztecContext, AztecEnv } from '../aztecEnv';
import { getInitialTestAccounts } from '@aztec/accounts/testing/lazy';
import { getSchnorrAccount } from '@aztec/accounts/schnorr/lazy';
import { ArrowRepeat } from 'react-bootstrap-icons';
import JSZip from 'jszip';
import axios from 'axios';
import { FileUtil } from './fileutils'; // fileutils.ts에서 가져옴
import type { FileInfo } from './fileutils'; // fileutils.ts에서 가져옴

interface InterfaceProps {
  client: Client<Api, Readonly<IRemixApi>>;
}

export const Main = ({ client }: InterfaceProps) => {
  const [openEnv, setOpenEnv] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<{ address: string }[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [openCompile, setOpenCompile] = useState(false);
  const [projectList, setProjectList] = useState<string[]>([]);
  const [targetProject, setTargetProject] = useState<string>('');
  const [openDeploy, setOpenDeploy] = useState(false);
  const [openInteract, setOpenInteract] = useState(false);
  const [compileLogs, setCompileLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const { pxe, setPXE, setNodeURL, setAztecNode, setPXEInitialized, setLogs, wallet, setWallet } =
    useContext(AztecContext);

  useEffect(() => {
    getList();
  }, []);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8082');
    ws.onopen = () => console.log('WebSocket connected');
    ws.onmessage = (event) => {
      setCompileLogs((prevLogs) => [...prevLogs, event.data]);
      console.log('WebSocket log:', event.data);
    };
    ws.onerror = (error) => console.error('WebSocket error:', error);
    return () => ws.close();
  }, []);

  const getList = async () => {
    const projects = await getProjectHaveTomlFile('browser/aztec');
    setProjectList(projects);
    setTargetProject(projects[0] || '');
  };

  const setTarget = (e: { target: { value: React.SetStateAction<string> } }) => {
    setTargetProject(e.target.value);
  };

  const connectToSandbox = async () => {
    setConnecting(true);
    setError(null);
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
        const accountManager = await getSchnorrAccount(
          pxeInstance,
          account.secret,
          account.signingKey,
          account.salt,
        );
        await accountManager.register();
        const walletInstance = await accountManager.getWallet();
        const address = walletInstance.getAddress().toString();
        accountWallets.push({ address, walletInstance });
      }
      setAccounts(accountWallets.map(({ address }) => ({ address })));
      setSelectedAccount(accountWallets[0].address);
      setWallet(accountWallets[0].walletInstance);
    } catch (err) {
      console.error(err);
      setError('Could not connect to the Aztec Sandbox. Is the Sandbox running?');
    } finally {
      setConnecting(false);
    }
  };

  const handleAccountChange = (e: { target: { value: React.SetStateAction<string> } }) => {
    const selected = e.target.value;
    setSelectedAccount(selected);
  };

  const getProjectHaveTomlFile = async (path: string): Promise<string[]> => {
    if (!client) return [];
    const projects: string[] = [];
    const findTomlFileRecursively = async (currentPath: string): Promise<void> => {
      const list = await client.fileManager.readdir(currentPath);
      const hasTomlFile = Object.keys(list).some((item) => item.endsWith('Nargo.toml'));
      if (hasTomlFile) {
        projects.push(currentPath.replace('browser/', ''));
      }
      for (const [key, value] of Object.entries(list)) {
        if ((value as any).isDirectory) {
          const additionalPath = key.split('/').pop();
          await findTomlFileRecursively(currentPath + '/' + additionalPath);
        }
      }
    };
    await findTomlFileRecursively(path);
    return projects;
  };

  /** 프로젝트 파일 목록을 가져오는 함수 */
  const getAllProjectFiles = async (projectPath: string): Promise<FileInfo[]> => {
    const files = await FileUtil.allFilesForBrowser(client, projectPath);
    // 'target' 디렉토리 제외
    return files.filter((file) => !file.path.startsWith(`${projectPath}/target`));
  };

  /** ZIP 파일을 생성하는 함수 */
const generateZip = async (files: FileInfo[], projectPath: string) => {
    const zip = new JSZip();
    await Promise.all(
      files.map(async (file) => {
        if (!file.isDirectory) {
          const content = await client.fileManager.readFile(file.path);
          // 'browser/' 부분을 제거하고, 프로젝트 루트 디렉토리를 최상위로 설정
          const relativePath = file.path.replace('browser/', '');
          // 예: 'aztec/token/src/main.nr' -> 'src/main.nr'
          const zipPath = relativePath.replace(`${projectPath}/`, '');
          zip.file(zipPath, content);
        }
      }),
    );
    return zip.generateAsync({ type: 'blob' });
  };

  /** 컴파일 처리 함수 */
  const handleCompile = async () => {
    if (!targetProject) {
      setCompileLogs((prev) => [...prev, 'No target project selected!']);
      return;
    }
  
    setLoading(true);
    setError(null);
  
    try {
      const projFiles = await getAllProjectFiles(targetProject);
      const zipBlob = await generateZip(projFiles, targetProject);
      const requestId = generateUniqueId(); // 고유 ID 생성
  
      const formData = new FormData();
      formData.append('file', zipBlob, `${targetProject}.zip`);
      formData.append('projectPath', targetProject);
  
      const response = await axios.post(
        `http://localhost:3000/compile?requestId=${requestId}`,
        formData,
        { responseType: 'arraybuffer' }
      );
  
      setCompileLogs((prev) => [...prev, `Project "${targetProject}" uploaded, compiling...`]);
  
      // 컴파일 결과 처리
      const compiledZip = await JSZip.loadAsync(response.data);
      await Promise.all(
        Object.entries(compiledZip.files).map(async ([path, file]) => {
          if (!file.dir) {
            const content = await file.async('string');
            const remixPath = `browser/${targetProject}/target/${path}`;
            await client.fileManager.writeFile(remixPath, content);
            setCompileLogs((prev) => [...prev, `File written to Remix: ${remixPath}`]);
          }
        })
      );
  
      setCompileLogs((prev) => [...prev, 'Compilation completed!']);
    } catch (error) {
      setError('Compilation failed.');
      setCompileLogs((prev) => [...prev, `Error: ${error.message}`]);
    } finally {
      setLoading(false);
    }
  };

  const generateUniqueId = () => {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `${timestamp}_${randomStr}`;
  };

  return (
    <>
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
                <a href="https://docs.aztec.network/sandbox" target="_blank" rel="noopener noreferrer">
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

              {error && <Alert variant="danger" className="mt-2">{error}</Alert>}

              {accounts.length > 0 && (
                <Form.Group className="mt-3">
                  <Form.Label>Sandbox Accounts</Form.Label>
                  <InputGroup>
                    <Form.Control
                      className="custom-select"
                      value={selectedAccount}
                      as="select"
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

      <Card className="mb-3">
        <Card.Header
          onClick={() => setOpenCompile(!openCompile)}
          aria-controls="compile-collapse"
          aria-expanded={openCompile}
          className="d-flex align-items-center justify-content-between"
          style={{ cursor: 'pointer' }}
        >
          <div className="d-flex align-items-center">Compile & Deploy</div>
          {openCompile ? <ChevronUp /> : <ChevronDown />}
        </Card.Header>
        <Collapse in={openCompile}>
          <div id="compile-collapse" style={{ transition: 'height 0.3s ease-in-out', overflow: 'hidden' }}>
            <Card.Body>
              <Form>
                <Form.Group>
                  <Form.Text className="text-muted">
                    <small>TARGET PROJECT </small>
                    <span style={{ cursor: 'pointer' }} onClick={getList}>
                      <ArrowRepeat />
                    </span>
                  </Form.Text>
                  <InputGroup className="mt-2">
                    <Form.Control
                      className="custom-select"
                      as="select"
                      value={targetProject}
                      onChange={setTarget}
                    >
                      <option value="">-- Select Project --</option>
                      {projectList.map((projectName, idx) => (
                        <option value={projectName} key={idx}>
                          {projectName}
                        </option>
                      ))}
                    </Form.Control>
                  </InputGroup>
                  <small className="text-muted mt-2 d-block">
                    The project must be located under the `aztec` folder in the root directory.
                  </small>
                </Form.Group>
                <Button
                  variant="primary"
                  className="w-100 mt-3"
                  disabled={!targetProject || loading}
                  onClick={handleCompile}
                >
                  {loading ? (
                    <>
                      <Spinner animation="border" size="sm" /> Compiling...
                    </>
                  ) : (
                    'Compile'
                  )}
                </Button>
                <div className="mt-3">
                  <small className="text-muted">Compilation Logs:</small>
                  <div
                    style={{
                      maxHeight: '200px',
                      overflowY: 'auto',
                      background: '#f8f9fa',
                      padding: '10px',
                    }}
                  >
                    {compileLogs.map((log, index) => (
                      <div key={index} style={{ fontSize: '0.75rem', whiteSpace: 'pre-line' }}>
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              </Form>
            </Card.Body>
          </div>
        </Collapse>
      </Card>

      <Card className="mb-3">
        <Card.Header
          onClick={() => setOpenDeploy(!openDeploy)}
          aria-controls="deploy-collapse"
          aria-expanded={openDeploy}
          className="d-flex align-items-center justify-content-between"
          style={{ cursor: 'pointer' }}
        >
          <div className="d-flex align-items-center">Interact</div>
          {openDeploy ? <ChevronUp /> : <ChevronDown />}
        </Card.Header>
        <Collapse in={openDeploy}>
          <div id="deploy-collapse" style={{ transition: 'height 0.3s ease-in-out', overflow: 'hidden' }}>
            <Card.Body>
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                Deploy your contract here.
              </p>
            </Card.Body>
          </div>
        </Collapse>
      </Card>

      <Card className="mb-3">
        <Card.Header
          onClick={() => setOpenInteract(!openInteract)}
          aria-controls="interact-collapse"
          aria-expanded={openInteract}
          className="d-flex align-items-center justify-content-between"
          style={{ cursor: 'pointer' }}
        >
          <div className="d-flex align-items-center">Proof</div>
          {openInteract ? <ChevronUp /> : <ChevronDown />}
        </Card.Header>
        <Collapse in={openInteract}>
          <div id="interact-collapse" style={{ transition: 'height 0.3s ease-in-out', overflow: 'hidden' }}>
            <Card.Body>
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                Interact with your deployed contract.
              </p>
            </Card.Body>
          </div>
        </Collapse>
      </Card>
    </>
  );
};