import { useRef, useState, useContext, useEffect } from 'react';
import { Collapse, Button, Card, Form, Alert, Spinner, InputGroup } from 'react-bootstrap';
import { ChevronDown, ChevronUp, ArrowRepeat } from 'react-bootstrap-icons';
import { AztecContext } from '../aztecEnv';
import JSZip from 'jszip';
import axios from 'axios';
import { FileUtil } from '../utils/fileutils';
import type { InterfaceProps, FileInfo } from '../types';
import { AztecAddress } from '@aztec/aztec.js';

interface Parameter {
  name: string;
  type: string;
}

export const CompileDeployCard = ({ client }: InterfaceProps) => {
  const [openCompile, setOpenCompile] = useState(false);
  const [projectList, setProjectList] = useState<string[]>([]);
  const [targetProject, setTargetProject] = useState<string>('');
  const [compileError, setCompileError] = useState<string | null>(null);
  const [compileLogs, setCompileLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<string | null>(null);
  const [contractFiles, setContractFiles] = useState<string[]>([]);
  const [selectedContract, setSelectedContract] = useState<string>('');
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [paramValues, setParamValues] = useState<Record<string, any>>({});
  const [canDeploy, setCanDeploy] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const requestIdRef = useRef<string>('');
  const [contractArtifact, setContractArtifact] = useState<any>(null);

  const { wallet, selectedAccount } = useContext(AztecContext);

  useEffect(() => {
    getList();
    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (targetProject) {
      checkDeployAvailability();
    } else {
      setCanDeploy(false);
      setContractFiles([]);
      setSelectedContract('');
      setParameters([]);
      setParamValues({});
    }
  }, [targetProject]);

  useEffect(() => {
    if (selectedContract) {
      loadContractParameters();
    }
  }, [selectedContract]);

  useEffect(() => {
    if (selectedAccount) {
      setParamValues((prev) => ({ ...prev, admin: selectedAccount }));
    }
  }, [selectedAccount]);

  const generateUniqueId = () => {
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
    const rand = Math.random().toString(36).substring(2, 8);
    return `req_${timestamp}_${rand}`;
  };

  const getList = async () => {
    const projects = await getProjectHaveTomlFile('browser/aztec');
    setProjectList(projects);
    setTargetProject(projects[0] || '');
  };

  const setTarget = (e: { target: { value: string } }) => {
    setTargetProject(e.target.value);
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

  const getAllProjectFiles = async (projectPath: string): Promise<FileInfo[]> => {
    const files = await FileUtil.allFilesForBrowser(client, projectPath);
    return files.filter((file) => !file.path.startsWith(`${projectPath}/target`));
  };

  const generateZip = async (files: FileInfo[], projectPath: string) => {
    const zip = new JSZip();
    await Promise.all(
      files.map(async (file) => {
        if (!file.isDirectory) {
          const content = await client.fileManager.readFile(file.path);
          const relativePath = file.path.replace('browser/', '');
          const zipPath = relativePath.replace(`${projectPath}/`, '');
          zip.file(zipPath, content);
        }
      })
    );
    return zip.generateAsync({ type: 'blob' });
  };

  const checkDeployAvailability = async () => {
    if (!targetProject) return;

    const artifactsPath = `${targetProject}/src/artifacts`;
    const targetPath = `${targetProject}/target`;

    const artifactsFiles = await FileUtil.allFilesForBrowser(client, artifactsPath);
    const targetFiles = await FileUtil.allFilesForBrowser(client, targetPath);

    const hasTsFiles = artifactsFiles.some((file) => file.path.endsWith('.ts'));
    const hasJsonFiles = targetFiles.some((file) => file.path.endsWith('.json'));
    setCanDeploy(hasTsFiles || hasJsonFiles);

    if (hasTsFiles) {
      const tsFiles = artifactsFiles
        .filter((file) => file.path.endsWith('.ts'))
        .map((file) => file.path);
      setContractFiles(tsFiles);
      setSelectedContract(tsFiles[0] || '');
    } else {
      setContractFiles([]);
      setSelectedContract('');
    }
  };

  const loadContractParameters = async () => {
    if (!client || !targetProject) return;
  
    try {
      const targetPath = `${targetProject}/target`;
      const targetFiles = await FileUtil.allFilesForBrowser(client, targetPath);
  
      const jsonFile = targetFiles.find((file) => file.path.endsWith('.json'));
      if (!jsonFile) {
        setCompileError('No compiled artifact (.json) found in target folder.');
        return;
      }
  
      const jsonContent = await client.fileManager.readFile(jsonFile.path);
      const artifact = JSON.parse(jsonContent);
      setContractArtifact(artifact);
  
      const deployMethod = artifact.functions?.find((fn: any) => fn.name === 'constructor');
  
      if (deployMethod) {
        const params = deployMethod.abi.parameters.map((param: any) => ({
          name: param.name,
          type: param.type.kind,
        }));
        setParameters(params);
  
        const initialValues: Record<string, any> = {};
        params.forEach((param: Parameter) => {
          if (param.name === 'admin' && selectedAccount) {
            initialValues[param.name] = selectedAccount;
          } else {
            initialValues[param.name] = '';
          }
        });
        setParamValues(initialValues);
      } else {
        setParameters([]);
        setParamValues({});
      }
    } catch (error) {
      console.error('Failed to load contract parameters:', error);
      setCompileError('Failed to load contract parameters: ' + error.message);
    }
  };

  const handleCompile = async () => {
    if (!targetProject) {
      await client.terminal.log({ type: 'error', value: 'No target project selected!' });
      setCompileError('No target project selected!');
      return;
    }
    setLoading(true);
    setCompileError(null);
    setCompileLogs([]);
    setDeployResult(null);

    requestIdRef.current = generateUniqueId();
    const ws = new WebSocket('ws://localhost:8082');
    wsRef.current = ws;

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => {
        ws.send(JSON.stringify({ requestId: requestIdRef.current }));
        resolve();
      };
      ws.onerror = (error) => {
        console.error('[Frontend] WebSocket connection error:', error);
        reject(new Error('WebSocket connection failed'));
      };
    });

    ws.onmessage = async (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.logMsg) {
          setCompileLogs((prev) => [...prev, parsed.logMsg]);
          await client.terminal.log({ type: 'info', value: parsed.logMsg });
        }
      } catch (e) {
        console.warn('[Frontend] Invalid WebSocket message:', event.data);
      }
    };

    ws.onerror = () => {
      setCompileError('WebSocket connection failed.');
      setLoading(false);
    };

    try {
      const projFiles = await getAllProjectFiles(targetProject);
      const zipBlob = await generateZip(projFiles, targetProject);

      const formData = new FormData();
      formData.append('file', zipBlob, `${targetProject}.zip`);
      formData.append('projectPath', targetProject);

      const response = await axios.post(
        `http://localhost:3000/compile?requestId=${requestIdRef.current}`,
        formData,
        { responseType: 'arraybuffer' }
      );

      const compiledZip = await JSZip.loadAsync(response.data);
      await Promise.all(
        Object.entries(compiledZip.files).map(async ([path, file]) => {
          if (!file.dir) {
            const content = await file.async('string');
            const remixPath = `browser/${targetProject}/${path}`;
            await client.fileManager.writeFile(remixPath, content);
          }
        })
      );

      await client.terminal.log({ type: 'info', value: '✅ Compilation completed!' });
      await checkDeployAvailability(); 
    } catch (error) {
      setCompileError(`Compilation failed: ${error.message}`);
      await client.terminal.log({ type: 'error', value: `❌ Compilation failed: ${error.message}` });
    } finally {
      setLoading(false);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
  };

  const handleDeploy = async () => {
    if (!wallet) {
      setCompileError('Wallet not initialized. Connect to Aztec Sandbox first.');
      return;
    }
    if (!targetProject) {
      setCompileError('No target project selected!');
      return;
    }
    if (!selectedContract) {
      setCompileError('No contract selected for deployment!');
      return;
    }

    setDeploying(true);
    setCompileError(null);
    setDeployResult(null);

    try {
      const contractModule = await import(/* @vite-ignore */ selectedContract);
      const contractName = selectedContract.split('/').pop()?.replace('.ts', '');
      const ContractClass = contractModule[`${contractName}Contract`];

      const args = parameters.map((param) => {
        const value = paramValues[param.name];
        if (param.name === 'admin') {
          return AztecAddress.fromString(value);
        }
        if (param.type === 'integer') {
          return BigInt(value);
        }
        return value;
      });

      const deployTx = ContractClass.deploy(wallet, ...args);
      const tx = await deployTx.send().wait();

      const contractAddress = tx.contractAddress.toString();
      setDeployResult(`Contract deployed successfully at address: ${contractAddress}`);
      await client.terminal.log({ type: 'info', value: `✅ Contract deployed at ${contractAddress}` });
    } catch (error) {
      setCompileError(`Deployment failed: ${error.message}`);
      await client.terminal.log({ type: 'error', value: `❌ Deployment failed: ${error.message}` });
    } finally {
      setDeploying(false);
    }
  };

  const handleParamChange = (paramName: string, value: any) => {
    setParamValues((prev) => ({ ...prev, [paramName]: value }));
  };

  return (
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
              {/* Compile Section */}
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

              {/* Deploy Section */}
              {canDeploy && (
                <>
                  <Form.Group className="mt-4">
                    <Form.Text className="text-muted">
                      <small>DEPLOY CONTRACT</small>
                    </Form.Text>
                    {contractFiles.length > 0 && (
                      <>
                        <Form.Label>Select Contract</Form.Label>
                        <Form.Control
                          as="select"
                          value={selectedContract}
                          onChange={(e) => setSelectedContract(e.target.value)}
                          className="mt-2"
                        >
                          {contractFiles.map((file, idx) => (
                            <option key={idx} value={file}>
                              {file.split('/').pop()}
                            </option>
                          ))}
                        </Form.Control>
                      </>
                    )}
                    {parameters.map((param) => (
                      <div key={param.name}>
                        <Form.Label className="mt-2">{param.name}</Form.Label>
                        <Form.Control
                          type={param.type === 'integer' ? 'number' : 'text'}
                          placeholder={`Enter ${param.name}`}
                          value={paramValues[param.name] || ''}
                          onChange={(e) => handleParamChange(param.name, e.target.value)}
                          className="mt-2"
                          disabled={param.name === 'admin'} // admin은 선택된 계정으로 고정
                        />
                      </div>
                    ))}
                  </Form.Group>
                  <Button
                    variant="success"
                    className="w-100 mt-3"
                    disabled={!wallet || deploying || !targetProject || !selectedContract}
                    onClick={handleDeploy}
                  >
                    {deploying ? (
                      <>
                        <Spinner animation="border" size="sm" /> Deploying...
                      </>
                    ) : (
                      'Deploy'
                    )}
                  </Button>

                  {/* Deploy Result */}
                  {deployResult && (
                    <Alert variant="success" className="mt-2">
                      {deployResult}
                    </Alert>
                  )}
                  {compileError && (
                    <Alert variant="danger" className="mt-2">
                      {compileError}
                    </Alert>
                  )}
                </>
              )}
            </Form>
          </Card.Body>
        </div>
      </Collapse>
    </Card>
  );
};