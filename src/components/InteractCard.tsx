import { useState, useEffect, useContext } from 'react';
import { Collapse, Button, Card, Form, InputGroup, Alert } from 'react-bootstrap';
import { ChevronDown, ChevronUp, X, Trash, Clipboard, ArrowRepeat } from 'react-bootstrap-icons';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import { AztecContext } from '../aztecEnv';
import type { InterfaceProps, FileInfo } from '../types';
import { Contract, AztecAddress, loadContractArtifact, AuthWitness, SentTx } from '@aztec/aztec.js';
import { FileUtil } from '../utils/fileutils';
import { getAllFunctionAbis } from '@aztec/stdlib/abi';
import { copyToClipboard } from '../utils/clipboard';

interface ContractInstance {
  address: AztecAddress;
  artifact: any;
  contract: Contract;
}

const FORBIDDEN_FUNCTIONS = ['process_log', 'sync_notes', 'public_dispatch'];

export const InteractCard = ({ client }: InterfaceProps) => {

  const [openInteract, setOpenInteract] = useState(false);
  const [contractInstances, setContractInstances] = useState<ContractInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<ContractInstance | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [atAddressInput, setAtAddressInput] = useState('');
  const [atAddressError, setAtAddressError] = useState<string | null>(null);
  const [functionAbis, setFunctionAbis] = useState<any[]>([]);
  const [selectedFunction, setSelectedFunction] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    searchTerm: '',
    private: true,
    public: true,
    unconstrained: true,
  });
  const [callParams, setCallParams] = useState<Record<string, Record<string, any>>>({});
  const [isSimulating, setIsSimulating] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [showAuthwitForm, setShowAuthwitForm] = useState(false);
  const [caller, setCaller] = useState('');
  const [alias, setAlias] = useState('');
  const [creatingAuthwit, setCreatingAuthwit] = useState(false);
  const [useAuthwit, setUseAuthwit] = useState(false);
  const [savedAliases, setSavedAliases] = useState<string[]>([]);
  const [selectedAlias, setSelectedAlias] = useState('');

  const { wallet, currentContract, currentContractAddress, targetProject, node } = useContext(AztecContext);

  useEffect(() => {
    if (currentContract && currentContractAddress && wallet && targetProject) {
      const loadArtifact = async () => {
        try {
          const targetPath = `${targetProject}/target`;
          const targetFiles = await FileUtil.allFilesForBrowser(client, targetPath);

          const jsonFile = targetFiles.find((file) => file.path.endsWith('.json'));
          if (!jsonFile) {
            await client.terminal.log({ type: 'warn', value: `No compiled artifact (.json) found in ${targetPath}. Compile the project first.` });
            return;
          }

          const jsonContent = await client.fileManager.readFile(jsonFile.path);
          const artifact = JSON.parse(jsonContent);

          const newInstance: ContractInstance = {
            address: currentContractAddress,
            artifact,
            contract: currentContract,
          };

          setContractInstances((prev) => {
            if (prev.some((inst) => inst.address.toString() === currentContractAddress.toString())) {
              return prev;
            }
            return [...prev, newInstance];
          });

          setSelectedInstance(newInstance);
        } catch (error) {
          setCallError('Failed to load contract artifact: ' + error.message);
        }
      };

      loadArtifact();
    } else {
    }
  }, [currentContract, currentContractAddress, wallet, targetProject, client]);

  useEffect(() => {
    if (selectedInstance) {
      try {
        const abis = getAllFunctionAbis(selectedInstance.artifact);
        setFunctionAbis(abis);
        setSelectedFunction(null);
        setCallParams({});
      } catch (error) {
        console.error('InteractCard - Failed to load function ABIs:', error);
        setFunctionAbis([]);
        setSelectedFunction(null);
        setCallParams({});
        setCallError('Failed to load function ABIs: ' + error.message);
      }
    } else {
      console.log('InteractCard - selectedInstance is null, resetting functionAbis');
      setFunctionAbis([]);
      setSelectedFunction(null);
      setCallParams({});
      setCallError(null);
    }
  }, [selectedInstance]);

  useEffect(() => {
    if (client) loadSavedAuthwitAliases();
  }, [client]);

  const loadSavedAuthwitAliases = async () => {
    try {
      const authwitPath = 'aztec/authwit';
      const fileMap = await client.fileManager.readdir(authwitPath);
      const aliases = Object.keys(fileMap)
        .filter(key => !fileMap[key].isDirectory && key.endsWith('.txt'))
        .map(key => key.split('/').pop().replace('.txt', ''));
      setSavedAliases(aliases);
    } catch (err) {
      console.warn('Failed to load saved AuthWitness aliases:', err);
    }
  };

  const handleToggleInteract = () => {
    setOpenInteract((prev) => {
      console.log('InteractCard - Toggling openInteract to:', !prev);
      return !prev;
    });
  };

  const handleInstanceChange = (e: React.ChangeEvent<any>) => {
    const address = e.target.value;
    const instance = contractInstances.find((inst) => inst.address.toString() === address);
    setSelectedInstance(instance || null);
    console.log('InteractCard - Selected instance:', instance ? instance.address.toString() : null);
  };

  const handleDeleteInstance = (address: string) => {
    setContractInstances((prev) => {
      const updated = prev.filter((inst) => inst.address.toString() !== address);
      return updated;
    });
    if (selectedInstance?.address.toString() === address) {
      const newSelected = contractInstances.length > 1 ? contractInstances[0] : null;
      setSelectedInstance(newSelected);
      console.log('InteractCard - New selectedInstance after deletion:', newSelected ? newSelected.address.toString() : null);
    }
  };

  const handleAtAddress = async () => {
    if (!atAddressInput || !wallet) {
      setAtAddressError('Please enter a valid address and ensure wallet is connected.');
      return;
    }
  
    try {
      setAtAddressError(null);
      const address = AztecAddress.fromString(atAddressInput);
  
      const rootPath = 'aztec';
      const allFiles = await FileUtil.allFilesForBrowser(client, rootPath);
    

      const jsonFiles = allFiles.filter(
        (file) =>
          file.path.endsWith('.json') &&
          file.path.startsWith('aztec/') &&
          file.path.split('/').length === 2
      );

      if (jsonFiles.length === 0) {
        setAtAddressError('No .json artifact found directly under aztec/. Please place one there.');
        return;
      }
  
      const jsonContent = await client.fileManager.readFile(jsonFiles[0].path);
      const artifact = JSON.parse(jsonContent);
  
      const contractArtifact = loadContractArtifact(artifact);

      const contract = await Contract.at(address, contractArtifact, wallet);
  
      const newInstance: ContractInstance = {
        address,
        artifact,
        contract,
      };
  
      setContractInstances((prev) => {
        if (prev.some((inst) => inst.address.toString() === address.toString())) {
          return prev;
        }
        return [...prev, newInstance];
      });
  
      setSelectedInstance(newInstance);
      setAtAddressInput('');
    } catch (error) {
      setAtAddressError(`Failed to load contract at address: ${error.message}`);
    }
  };
  

  const handleFunctionChange = async (e: React.ChangeEvent<any>) => {
    const fnName = e.target.value;
    setSelectedFunction(fnName);
    await loadSavedAuthwitAliases();
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev) => {
      const updated = { ...prev, [key]: value };
      return updated;
    });
   
    setSelectedFunction(null);
  };

  const handleParameterChange = (fnName: string, paramName: string, value: any) => {
    setCallParams((prev) => {
      const fnParameters = prev[fnName] || {};
      fnParameters[paramName] = value;
      const updated = { ...prev, [fnName]: fnParameters };
      return updated;
    });
  };

  const handleCloseCallError = () => {
    setCallError(null);
    console.log('InteractCard - Closed callError alert');
  };

  const handleCloseAtAddressError = () => {
    setAtAddressError(null);
  };

  const convertParameter = (param: any, value: string) => {
    if (!value) return undefined;

    const type = param.type;
    if (type.kind === 'integer') {
      return parseInt(value, 10);
    } else if (type.kind === 'field') {
      return value; 
    } else if (type.kind === 'struct' && type.path.includes('AztecAddress')) {
      return AztecAddress.fromString(value);
    } else if (type.kind === 'boolean') {
      return value.toLowerCase() === 'true';
    }
    return value; 
  };

  const serializeBigInt = (obj: any) => {
    return JSON.stringify(
      obj,
      (key, value) => (typeof value === 'bigint' ? value.toString() : value),
      2
    );
  };

  const handleFunctionCall = async (mode: 'simulate' | 'send') => {
    if (!selectedInstance || !selectedFunction || !selectedFunctionAbi) {
      setCallError('Please select a contract instance and function.');
      return;
    }

    const isViewFunction = selectedFunctionAbi.custom_attributes?.includes('view');

    if (mode === 'send' && isViewFunction) {
      setCallError('View functions cannot be executed with Send. Use Simulate instead.');
      return;
    }

    if (mode === 'simulate') {
      setIsSimulating(true);
    } else {
      setIsSending(true);
    }
    setCallError(null);

    try {
      const params = selectedFunctionAbi.abi.parameters
        .filter((param: any, index: number) => {
          const isPrivate = selectedFunctionAbi.custom_attributes?.includes('private');
          return !(isPrivate && index === 0 && param.name === 'inputs');
        }).map((param: any) => {
          const value = callParams[selectedFunction]?.[param.name];
          if (value === undefined || value === '') {
            throw new Error(`Parameter ${param.name} is required.`);
          }
          const converted = convertParameter(param, value);
          if (converted === undefined) {
            throw new Error(`Invalid value for parameter ${param.name}.`);
          }
          return converted;
        });

      const method = selectedInstance.contract.methods[selectedFunction];
      if (!method) {
        throw new Error(`Function ${selectedFunction} not found in contract.`);
      }

      if (mode === 'simulate') {
        const result = await method(...params).simulate();
        await client.terminal.log({ type: 'info', value: `Simulation successful:\n${serializeBigInt(result)}` });
      } else {
        let tx: SentTx;
        if (useAuthwit && selectedAlias) {
          const witnessJson = await client.fileManager.readFile(`aztec/authwit/${selectedAlias}.txt`);
          const parsed = JSON.parse(witnessJson)
          
          if (selectedFunctionAbi?.custom_attributes?.includes('public')) {
            tx = await currentContract.withWallet(wallet).methods[selectedFunction](...params).send();
          } else {
            tx = await currentContract.withWallet(wallet).methods[selectedFunction](...params).send({
              authWitnesses: [parsed.witness],
            });
          }
        } else {
          tx = await currentContract.withWallet(wallet).methods[selectedFunction](...params).send();
        }
        const receipt = await tx.wait();
        await client.terminal.log({ type: 'info', value: `Transaction successful:\n${serializeBigInt(receipt)}` });
      }
    } catch (error) {
      console.error('InteractCard - Function call error:', error);
      setCallError(`Failed to ${mode} function: ${error.message}`);
    } finally {
      if (mode === 'simulate') {
        setIsSimulating(false);
      } else {
        setIsSending(false);
      }
    }
  };

  const filteredFunctions = Array.isArray(functionAbis)
    ? functionAbis.filter((fn) => {
        const isForbidden = FORBIDDEN_FUNCTIONS.includes(fn.name);
        const isInternal = fn.custom_attributes?.includes('internal') || false;
        const isInitializer = Array.isArray(fn.custom_attributes) && fn.custom_attributes.includes('initializer');
      
        const matchesSearch =
          filters.searchTerm === '' || fn.name.toLowerCase().includes(filters.searchTerm.toLowerCase());

        let functionType = 'public'; 
        if (fn.custom_attributes?.includes('private')) {
          functionType = 'private';
        } else if (fn.custom_attributes?.includes('public')) {
          functionType = 'public';
        }
        const isUnconstrained = fn.is_unconstrained === true;

        const matchesType =
          (filters.private && functionType === 'private') ||
          (filters.public && functionType === 'public') ||
          (filters.unconstrained && isUnconstrained);

        return !isInternal && !isForbidden && !isInitializer && matchesType && matchesSearch;
      })
    : [];

  const selectedFunctionAbi = functionAbis.find((fn) => fn.name === selectedFunction);

  const shortenAddress = (addr: string) => {
    if (!addr) return '';
    return addr.length > 12 ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : addr;
  };

  const handleCreateAuthwit = async () => {
    try {
      setCreatingAuthwit(true);
      setCallError(null);
  
      if (!wallet || !currentContract || !selectedFunction || !selectedFunctionAbi) {
        throw new Error('Missing wallet, contract, or function');
      }
  
      const params = selectedFunctionAbi.abi.parameters
        .filter((param: any, index: number) => {
          const isPrivate = selectedFunctionAbi.custom_attributes?.includes('private');
          return !(isPrivate && index === 0 && param.name === 'inputs');
        })
        .map((param: any) => {
          const value = callParams[selectedFunction]?.[param.name];
          const converted = convertParameter(param, value);
          if (converted === undefined || converted === null) {
            throw new Error(`Invalid or missing value for parameter: ${param.name}`);
          }
          return converted;
        });
  
      const action = currentContract.withWallet(wallet).methods[selectedFunction](...params);
  
      if (!caller || !alias) {
        throw new Error('Caller and alias are required.');
      }
  
      const proofDir = 'aztec/authwit';
      const fileName = `${alias}.txt`;
      const fileMap = await client.fileManager.readdir(proofDir);
      const exists = Object.keys(fileMap).some(key => key.split('/').pop() === fileName);
      if (exists) {
        setCallError(`❗️AuthWitness with alias "${alias}" already exists in ${proofDir}. Please choose a different name.`);
        return;
      }
  
      const isPublic = selectedFunctionAbi?.custom_attributes?.includes('public');
      let meta;
      if (isPublic) {
        const interaction = await wallet.setPublicAuthWit(
          {
            caller: AztecAddress.fromString(caller),
            action,
          },
          true,
        );
        const receipt = await interaction.send().wait();
  
        await client.terminal.log({
          type: 'info',
          value: `✅ Public AuthWitness registered on-chain for function "${selectedFunction}"\nTx Hash: ${receipt.txHash}`,
        });
  
        meta = JSON.stringify(
          {
            type: 'public',
            caller,
            action: action,
            txHash: receipt.txHash,
            createdAt: new Date().toISOString(),
          },
          null,
          2,
        );
  
        await client.fileManager.writeFile(`${proofDir}/${fileName}`, meta);
      } else {
        const witness = await wallet.createAuthWit({
          caller: AztecAddress.fromString(caller),
          action,
        });
  
        meta = JSON.stringify(
          {
            type: 'private',
            caller,
            witness: witness.toJSON(),
            createdAt: new Date().toISOString(),
          },
          null,
          2,
        );

        await client.fileManager.writeFile(`${proofDir}/${fileName}`, meta);
  
        await client.terminal.log({
          type: 'info',
          value: `✅ Private AuthWitness created and saved to ${proofDir}/${fileName}`,
        });
        await loadSavedAuthwitAliases();  
      }
    } catch (err: any) {
      console.error('handleCreateAuthwit - error:', err);
      setCallError(`AuthWitness creation failed: ${err.message}`);
    } finally {
      setCreatingAuthwit(false);
    }
  };
  
  return (
    <Card className="mb-3">
      <Card.Header
        onClick={handleToggleInteract}
        aria-controls="interact-collapse"
        aria-expanded={openInteract}
        className="d-flex align-items-center justify-content-between"
        style={{ cursor: 'pointer' }}
      >
        <div className="d-flex align-items-center">Interact</div>
        {openInteract ? <ChevronUp /> : <ChevronDown />}
      </Card.Header>
      <Collapse in={openInteract}>
        <div id="interact-collapse" style={{ transition: 'height 0.3s ease-in-out', overflow: 'hidden' }}>
          <Card.Body>
            <Form>
              {/* Contract Instances */}
              <Form.Group>
                <Form.Label>Contract Instances</Form.Label>
                <InputGroup className="mt-2">
                  <Form.Control
                    className="custom-select"
                    as="select"
                    value={selectedInstance?.address.toString() || ''}
                    onChange={handleInstanceChange}
                    disabled={contractInstances.length === 0}
                  >
                    {contractInstances.length === 0 ? (
                      <option value="">No instances available</option>
                    ) : (
                      contractInstances.map((inst) => (
                        <option key={inst.address.toString()} value={inst.address.toString()}>
                          {shortenAddress(inst.address.toString())}
                        </option>
                      ))
                    )}
                  </Form.Control>
                  {selectedInstance && (
                    <>
                      <span style={{ width: '5px', display: 'inline-block' }}></span>
                      <OverlayTrigger placement="top" overlay={<Tooltip>Copy Address</Tooltip>}>
                        <span style={{ cursor: 'pointer' }} onClick={() => copyToClipboard(selectedInstance.address.toString())}>
                          <Clipboard />
                        </span>
                      </OverlayTrigger>
                      <span style={{ width: '5px', display: 'inline-block' }}></span>
                      <OverlayTrigger placement="top" overlay={<Tooltip>Delete</Tooltip>}>
                        <span style={{ cursor: 'pointer' }} onClick={() => handleDeleteInstance(selectedInstance.address.toString())}>
                          <Trash />
                        </span>
                      </OverlayTrigger>
                    </>
                  )}
                </InputGroup>
              </Form.Group>

              {/* At Address */}
              <Form.Group className="mt-3" style={{marginTop: "10px"}}>
                <Form.Label>At Address</Form.Label>
                <InputGroup>
                  <OverlayTrigger
                    placement="top"
                    overlay={
                      <Tooltip className="text-start">
                        Make sure you've placed a compiled .json artifact directly under the aztec/ folder. This will be used to connect to the contract at the address you enter.
                      </Tooltip>
                    }
                  >
                    <Button variant="primary" size="sm" className="px-3" onClick={handleAtAddress}>
                      At Address
                    </Button>
                  </OverlayTrigger>
                  <OverlayTrigger
                    placement="top"
                    overlay={<Tooltip>Address of Contract</Tooltip>}
                  >
                    <Form.Control
                      type="text"
                      placeholder="contract address"
                      value={atAddressInput}
                      onChange={(e) => {
                        setAtAddressInput(e.target.value);
                      }}
                    />
                  </OverlayTrigger>
                </InputGroup>
                {atAddressError && (
                  <Alert
                    variant="danger"
                    className="mt-2"
                    style={{
                      fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
                      fontSize: '12px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-start w-100">
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {atAddressError}
                      </div>
                      <Button
                        variant="link"
                        onClick={handleCloseAtAddressError}
                        className="p-0 ms-2"
                        style={{ lineHeight: 1 }}
                      >
                        <X size={20} />
                      </Button>
                    </div>
                  </Alert>
                )}
              </Form.Group>

              {/* Function Filters */}
              {selectedInstance && (
                <>
                  <Form.Group className="mt-3"  style={{marginTop: "10px"}}>
                    <Form.Label>Filter Functions</Form.Label>
                    <InputGroup className="mb-2">
                      <Form.Control
                        type="text"
                        placeholder="Search function"
                        value={filters.searchTerm}
                        onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                      />
                    </InputGroup>
                    <div className="d-flex">
                      <div className="custom-control custom-checkbox me-3 mr-2">
                        <input
                          type="checkbox"
                          className="custom-control-input"
                          id="filterPrivate"
                          checked={filters.private}
                          onChange={(e) => handleFilterChange('private', e.target.checked)}
                        />
                        <label className="custom-control-label" htmlFor="filterPrivate">Private</label>
                      </div>
                      <div className="custom-control custom-checkbox me-3 mr-2">
                        <input
                          type="checkbox"
                          className="custom-control-input"
                          id="filterPublic"
                          checked={filters.public}
                          onChange={(e) => handleFilterChange('public', e.target.checked)}
                        />
                        <label className="custom-control-label" htmlFor="filterPublic">Public</label>
                      </div>
                      <div className="custom-control custom-checkbox">
                        <input
                          type="checkbox"
                          className="custom-control-input"
                          id="filterUnconstrained"
                          checked={filters.unconstrained}
                          onChange={(e) => handleFilterChange('unconstrained', e.target.checked)}
                        />
                        <label className="custom-control-label" htmlFor="filterUnconstrained">Unconstrained</label>
                      </div>
                    </div>
                  </Form.Group>

                  {/* Function Selection */}
                  {filteredFunctions.length > 0 ? (
                    <Form.Group className="mt-3"  style={{marginTop: "10px"}}>
                      <Form.Label>Select Function</Form.Label>
                      <InputGroup className="mt-2">
                      <Form.Control
                        className="custom-select"
                        as="select"
                        value={selectedFunction || ''}
                        onChange={handleFunctionChange}
                      >
                        <option value="">Select a function</option>
                        {filteredFunctions.map((fn) => {
                          const functionType = fn.custom_attributes?.includes('private')
                            ? 'private'
                            : fn.custom_attributes?.includes('public')
                            ? 'public'
                            : 'public';
                          const isUnconstrained = fn.is_unconstrained === true;
                          const additionalTags = fn.custom_attributes
                            ?.filter((tag: string) => !['private', 'public'].includes(tag))
                            .join(', ');
                          const displayTags = [
                            functionType,
                            isUnconstrained ? 'unconstrained' : '',
                            additionalTags,
                          ]
                            .filter(Boolean)
                            .join(', ');
                          return (
                            <option key={fn.name} value={fn.name}>
                              {fn.name} ({displayTags})
                            </option>
                          );
                        })}
                      </Form.Control>
                    </InputGroup>
                    </Form.Group>
                  ) : (
                    selectedInstance && (
                      <Alert variant="info" className="mt-3" style={{
                        fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                        fontSize: '12px',
                      }}>
                        No functions available to display. Check the contract ABI or adjust the filters.
                      </Alert>
                    )
                  )}

                  {/* Function Parameters */}
                  {selectedFunction && selectedFunctionAbi && (
                    <div className="mt-3">
                      {selectedFunctionAbi.abi.parameters &&
                      selectedFunctionAbi.abi.parameters.length > 0 ? (
                        selectedFunctionAbi.abi.parameters
                          .filter((param: any, index: number) => {
                            const isPrivate = selectedFunctionAbi.custom_attributes?.includes('private');
                            const isFirst = index === 0;
                            return !(isPrivate && isFirst && param.name === 'inputs');
                          })
                          .map((param: any) => (
                            <Form.Group key={param.name} className="mb-2" style={{ marginTop: '10px' }}>
                              <Form.Label>{param.name}</Form.Label>
                              <Form.Control
                                type={param.type.kind === 'integer' ? 'number' : 'text'}
                                placeholder={`Enter ${param.name}`}
                                value={callParams[selectedFunction]?.[param.name] || ''}
                                onChange={(e) => handleParameterChange(selectedFunction, param.name, e.target.value)}
                              />
                            </Form.Group>
                          ))
                      ) : (
                        <p>No parameters for this function.</p>
                      )}
                      <Form.Check
                        type="switch"
                        id="use-authwit-switch"
                        label={
                          <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip>Send will include the selected AuthWitness.</Tooltip>}
                          >
                            <span>Use AuthWitness</span>
                          </OverlayTrigger>
                        }
                        checked={useAuthwit}
                        onChange={(e) => setUseAuthwit(e.target.checked)}
                        className="mt-3 mb-2"
                      />

                      {useAuthwit && (
                        <Form.Group className="mb-3">
                          <Form.Label>Select AuthWitness Alias</Form.Label>
                            <OverlayTrigger placement="top" overlay={<Tooltip>Reload</Tooltip>}>
                              <span style={{ cursor: 'pointer', marginLeft: '3px' }} onClick={loadSavedAuthwitAliases}>
                                <ArrowRepeat />
                              </span>
                            </OverlayTrigger>
                          <Form.Control
                            as="select"
                            value={selectedAlias}
                            onChange={(e) => setSelectedAlias(e.target.value)}
                            disabled={savedAliases.length === 0}
                          >
                            <option value="">-- Select an alias --</option>
                            {savedAliases.map((alias) => (
                              <option key={alias} value={alias}>
                                {alias}
                              </option>
                            ))}
                          </Form.Control>
                          {savedAliases.length === 0 && (
                            <div className="text-muted mt-1" style={{ fontSize: '12px' }}>
                              No saved AuthWitness files. Create one first.
                            </div>
                          )}
                        </Form.Group>
                      )}
                      {/* Simulate and Send Buttons */}
                      <div className="d-flex mt-3 flex-wrap w-100">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleFunctionCall('simulate')}
                          disabled={isSimulating}
                          className="flex-grow-1 me-2"
                          style={{ marginRight: '5px' }}
                        >
                          Simulate
                        </Button>

                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleFunctionCall('send')}
                          disabled={isSending || selectedFunctionAbi?.custom_attributes?.includes('view')}
                          className="flex-grow-1 me-2"
                          style={{ marginRight: '5px' }}
                        >
                          Send
                        </Button>

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setShowAuthwitForm(prev => !prev)}
                          className="flex-grow-1"
                          
                        >
                          AuthWit
                        </Button>
                      </div>
                      {showAuthwitForm && (
                          <div className="mt-3 p-3 border rounded bg-light">
                            <Form.Group className="mb-2">
                              <Form.Label>Caller Address (Aztec Address)</Form.Label>
                              <Form.Control
                                type="text"
                                placeholder="Enter caller address"
                                value={caller}
                                onChange={(e) => setCaller(e.target.value)}
                              />
                            </Form.Group>

                            <Form.Group className="mb-2">
                              <Form.Label>Alias</Form.Label>
                              <Form.Control
                                type="text"
                                placeholder="Enter alias for this AuthWitness"
                                value={alias}
                                onChange={(e) => setAlias(e.target.value)}
                              />
                            </Form.Group>

                            <Button
                              variant="warning"
                              size="sm"
                              disabled={!caller || !alias || creatingAuthwit}
                              onClick={handleCreateAuthwit}
                            >
                              Create
                            </Button>
                          </div>
                        )}
                    </div>
                  )}
                </>
              )}

              {callError && (
                <Alert variant="danger" className="mt-2" style={{
                  fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
                  fontSize: '12px',
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-word', 
                  overflowWrap: 'anywhere', 
                }}>
                  <div className="d-flex justify-content-between align-items-start w-100">
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{callError}</div>
                    <Button variant="link" onClick={handleCloseCallError} className="p-0 ms-2">
                      <X size={20} />
                    </Button>
                  </div>
                </Alert>
              )}
            </Form>
          </Card.Body>
        </div>
      </Collapse>
    </Card>
  );
};