import { useRef, useState, useContext, useEffect } from 'react';
import { Collapse, Button, Card, Form, Alert, Spinner, InputGroup, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { ChevronDown, ChevronUp, ArrowRepeat } from 'react-bootstrap-icons';
import { AztecContext } from '../aztecEnv';
import JSZip from 'jszip';
import axios from 'axios';
import { FileUtil } from '../utils/fileutils';
import type { InterfaceProps, FileInfo } from '../types';
import {
  loadContractArtifact,
  Contract,
} from '@aztec/aztec.js';
import { encodeArguments, getDefaultInitializer, getInitializer, getAllFunctionAbis } from '@aztec/stdlib/abi';

interface Parameter {
  name: string;
  type: string;
}

const BASE_URL = process.env.REACT_APP_API_BASE_URL;
const WS_URL = process.env.REACT_APP_WS_URL;

export const CompileDeployCard = ({ client }: InterfaceProps) => {
  const [openCompile, setOpenCompile] = useState(false);
  const [projectList, setProjectList] = useState<string[]>([]);
  const [targetProject, setLocalTargetProject] = useState<string>('');
  const [compileError, setCompileError] = useState<string | null>(null);
  const [compileLogs, setCompileLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deployResult, setDeployResult] = useState<string | null>(null);
  const [selectedContract, setSelectedContract] = useState<string>('');
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [paramValues, setParamValues] = useState<Record<string, any>>({});
  const [canDeploy, setCanDeploy] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const requestIdRef = useRef<string>('');
  const [contractArtifact, setContractArtifact] = useState<any>(null);
  const [jsonFiles, setJsonFiles] = useState<string[]>([]);
  const [lastCompiledJson, setLastCompiledJson] = useState<string | null>(null);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [queueWaitTime, setQueueWaitTime] = useState<number | null>(null);

  const { wallet, setCurrentContract, setCurrentContractAddress, setTargetProject } = useContext(AztecContext);

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
      setTargetProject(targetProject);
      checkDeployAvailability();
    } else {
      setCanDeploy(false);
      setSelectedContract('');
      setParameters([]);
      setParamValues({});
      setJsonFiles([]);
    }
  }, [targetProject, setTargetProject]);

  useEffect(() => {
    if (selectedContract) {
      loadContractParameters();
    }
  }, [selectedContract]);

  useEffect(() => {
    console.log('CompileDeployCard sees wallet:', wallet?.getAddress().toString());
  }, [wallet]);

  const generateUniqueId = () => {
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
    const rand = Math.random().toString(36).substring(2, 8);
    return `req_${timestamp}_${rand}`;
  };

  const getList = async () => {
    const projects = await getProjectHaveTomlFile('browser/aztec');
    setProjectList(projects);
    setLocalTargetProject(projects[0] || '');
  };

  const setTarget = (e: { target: { value: string } }) => {
    setLocalTargetProject(e.target.value);
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
    if (!targetProject) return; // targetProject가 없으면 종료
  
    const searchPath = `browser/${targetProject}`; // 예: browser/aztec/project1
    console.log('Starting walk at:', searchPath);
  
    const foundJsons = await findAllJsonArtifacts(searchPath);
    setJsonFiles(foundJsons);
  
    if (lastCompiledJson && foundJsons.includes(lastCompiledJson)) {
      setSelectedContract(lastCompiledJson);
    } else if (foundJsons.length > 0) {
      setSelectedContract(foundJsons[0]);
    } else {
      setSelectedContract(''); // .json 파일이 없으면 선택 초기화
    }
  
    console.log('Found JSON files for', targetProject, ':', foundJsons);
    setCanDeploy(foundJsons.length > 0);
  };

  const loadContractParameters = async () => {
    if (!client || !targetProject || !selectedContract) return;
  
    try {
      const artifactJson = await client.fileManager.readFile(`browser/${selectedContract}`);
      const parsed = JSON.parse(artifactJson);
      const artifact = loadContractArtifact(parsed); 
  
      setContractArtifact(artifact);
  
      const initializer = getDefaultInitializer(artifact); 
      if (initializer && initializer.parameters?.length) {

        const filteredParams = initializer.parameters.filter(
          p => !(initializer.functionType === 'private' && p.name === 'inputs')
        );

        const params = filteredParams.map((param) => ({
          name: param.name,
          type: param.type.kind,
        }));
        setParameters(params);
  
        const initialValues: Record<string, any> = {};
        params.forEach((param) => {
          initialValues[param.name] = '';
        });
        setParamValues(initialValues);
      } else {
        setParameters([]);
        setParamValues({});
      }
    } catch (err: any) {
      setCompileError(`Failed to load contract parameters: ${err.message}`);
      console.error('loadContractParameters error:', err);
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

    const ws = new WebSocket(`${WS_URL}`);
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
        `${BASE_URL}/compile?requestId=${requestIdRef.current}`,
        formData
      );
      
      if (!response.data || !response.data.url) {
        throw new Error('S3 URL not returned from backend');
      }
      
      const zipResponse = await axios.get(response.data.url, { responseType: 'arraybuffer' });
      const compiledZip = await JSZip.loadAsync(zipResponse.data);

      await Promise.all(
        Object.entries(compiledZip.files).map(async ([path, file]) => {
          if (!file.dir) {
            const content = await file.async('string');
            const remixPath = `browser/${targetProject}/${path}`;
            await client.fileManager.writeFile(remixPath, content);

            if (remixPath.endsWith('.json')) {
              setLastCompiledJson(remixPath.replace('browser/', ''));
            }
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

  const findAllJsonArtifacts = async (rootPath: string): Promise<string[]> => {
    const all: string[] = [];
  
    const walk = async (path: string) => {
      try {
        const entries = await client.fileManager.readdir(path);
        for (const [name, entry] of Object.entries(entries)) {
          const relativeName = name.split('/').pop() || name;
          const fullPath = `${path}/${relativeName}`;
          console.log('Checking:', fullPath);
  
          if ((entry as any).isDirectory) {
            await walk(fullPath);
          } else if (name.endsWith('.json') && fullPath.includes('/target/')) {
            const cleaned = fullPath.replace(/^browser\//, '');
            all.push(cleaned); 
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${path}:`, error);
      }
    };
  
    await walk(rootPath);
    return all;
  };
  
  const handleDeploy = async () => {
    
    if (!wallet) {
      setDeployError('Wallet not initialized. Connect to Aztec Sandbox first.');
      return;
    }
    if (!selectedContract) {
      setDeployError('No contract selected for deployment!');
      return;
    }
  
    try {
      setDeploying(true);
      setDeployError(null);
      setDeployResult(null);
  
      const artifactJson = await client.fileManager.readFile(`browser/${selectedContract}`);
      const contractArtifact = loadContractArtifact(JSON.parse(artifactJson));

      const functionAbis = getAllFunctionAbis(contractArtifact);
      const initializer = getInitializer(contractArtifact, functionAbis.find(fn => fn.isInitializer)?.name);

      const args = initializer?.parameters?.length
        ? initializer.parameters.map(p => paramValues[p.name])
        : [];

      const deployed = await Contract.deploy(wallet, contractArtifact, args)
      .send().deployed()
      
      const contractAddress = deployed.instance.address;
      setCurrentContract(deployed);
      setCurrentContractAddress(contractAddress);
      setDeployResult(`✅ Contract deployed at address: ${contractAddress}`);
      await client.terminal.log({ type: 'info', value: `✅ Contract deployed at ${contractAddress}` });
    } catch (error) {
      setDeployError(`Deployment failed: ${error.message}`);
      await client.terminal.log({ type: 'error', value: `❌ Deployment failed: ${error.message}` });
    } finally {
      setDeploying(false);
    }
  };

  const handleParamChange = (paramName: string, value: any) => {
    setParamValues((prev) => ({ ...prev, [paramName]: value }));
  };

  const checkQueueStatus = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/queue/status`, {
        params: { requestId: requestIdRef.current },
      });
  
      setQueuePosition(res.data.position);
    } catch (err) {
      console.warn('Failed to check queue status', err);
    }
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
                  <OverlayTrigger placement="top" overlay={<Tooltip>Reload</Tooltip>}>
                    <span style={{ cursor: 'pointer' }} onClick={getList}>
                      <ArrowRepeat />
                    </span>
                  </OverlayTrigger>
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
              {loading && (
                <div className="mt-3" style={{marginTop: "10px"}}>
                  <div className="d-flex align-items-center justify-content-between">
                    <Button size="sm" variant="outline-primary" onClick={checkQueueStatus}>
                      Check Compile Order
                    </Button>
                  </div>
                  {queuePosition !== null && (
                    <Alert variant="info" className="mt-2" style={{
                      fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                      fontSize: '12px',
                    }}>
                      You're currently <strong>#{queuePosition + 1}</strong> in the queue.<br />
                    </Alert>
                  )}
                </div>
              )}
              {/* Info Message when no artifacts */}
              {!canDeploy && targetProject && (
                <Alert variant="info" className="mt-2" style={{
                  fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  fontSize: '12px'
                }}>
                  No compiled artifacts found. Please compile the project to generate .json files.
                </Alert>
              )}
              {compileError && (
                <Alert variant="danger" className="mt-2" style={{
                  fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  fontSize: '12px',
                }}>
                  {compileError}
                </Alert>
              )}
              {/* Deploy Section */}
              {canDeploy && jsonFiles.length > 0 && (
                <>
                  <Form.Group className="mt-4">
                    <Form.Text className="text-muted">
                      <small>DEPLOY CONTRACT</small>
                    </Form.Text>
                    <Form.Label>Select Artifact</Form.Label>
                    <InputGroup className="mt-2">
                      <Form.Control
                        className="custom-select"
                        as="select"
                        value={selectedContract}
                        onChange={(e) => setSelectedContract(e.target.value)}
                      >
                        {jsonFiles.map((file, idx) => (
                          <option key={idx} value={file}>
                            {file.split('/').slice(-2).join('/')} {/* e.g., target/contract.json */}
                          </option>
                        ))}
                      </Form.Control>
                    </InputGroup>
                    {parameters.map((param) => (
                      <div key={param.name}>
                        <Form.Label className="mt-2">{param.name}</Form.Label>
                        <Form.Control
                          type={param.type === 'integer' ? 'number' : 'text'}
                          placeholder={`Enter ${param.name}`}
                          value={paramValues[param.name] || ''}
                          onChange={(e) => handleParamChange(param.name, e.target.value)}
                          className="mt-2"
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
                    <Alert variant="success" className="mt-2" 
                      style={{
                        fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                        fontSize: '12px',
                    }}>
                      {deployResult}
                    </Alert>
                  )}
                  {deployError && (
                    <Alert variant="danger" className="mt-2" style={{
                      fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                      fontSize: '12px',
                    }}>
                      {deployError}
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