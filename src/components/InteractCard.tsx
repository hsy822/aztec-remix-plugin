import { useState, useEffect, useContext } from 'react';
import { Collapse, Button, Card, Form, InputGroup, Alert } from 'react-bootstrap';
import { ChevronDown, ChevronUp, X } from 'react-bootstrap-icons';
import { AztecContext } from '../aztecEnv';
import type { InterfaceProps, FileInfo } from '../types';
import { Contract, AztecAddress } from '@aztec/aztec.js';
import { FileUtil } from '../utils/fileutils';
import { getAllFunctionAbis } from '@aztec/stdlib/abi';

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
  const [callResult, setCallResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { wallet, currentContract, currentContractAddress, targetProject } = useContext(AztecContext);

  useEffect(() => {
    if (currentContract && currentContractAddress && wallet && targetProject) {
      const loadArtifact = async () => {
        try {
          const targetPath = `${targetProject}/target`;
          const targetFiles = await FileUtil.allFilesForBrowser(client, targetPath);

          const jsonFile = targetFiles.find((file) => file.path.endsWith('.json'));
          if (!jsonFile) {
            const errorMsg = `No compiled artifact (.json) found in ${targetPath}. Available files: ${
              targetFiles.length > 0
                ? targetFiles.map((f) => f.path).join(', ')
                : 'none'
            }`;
            setCallError(errorMsg);
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
      console.log('InteractCard - Missing required context data:', {
        currentContract: !!currentContract,
        currentContractAddress: !!currentContractAddress,
        wallet: !!wallet,
        targetProject: !!targetProject,
      });
    }
  }, [currentContract, currentContractAddress, wallet, targetProject, client]);

  useEffect(() => {
    if (selectedInstance) {
      try {
        const abis = getAllFunctionAbis(selectedInstance.artifact);
        console.log('InteractCard - Loaded function ABIs:', abis);
        abis.forEach((fn, index) => {
          console.log(
            `Function ${index} - Name: ${fn.name}, custom_attributes: ${(fn as any).custom_attributes}, is_unconstrained: ${(fn as any).is_unconstrained}`
          );
        });
        setFunctionAbis(abis);
        setSelectedFunction(null);
        setCallParams({});
        setCallResult(null);
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
      setCallResult(null);
    }
  }, [selectedInstance]);

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
      console.log('InteractCard - At Address - Missing input or wallet:', {
        atAddressInput,
        wallet: !!wallet,
      });
      return;
    }

    try {
      setAtAddressError(null);
      const address = AztecAddress.fromString(atAddressInput);

      const targetPath = targetProject ? `${targetProject}/target` : `aztec`;
      const targetFiles = await FileUtil.allFilesForBrowser(client, targetPath);

      const jsonFile = targetFiles.find((file) => file.path.endsWith('.json'));
      if (!jsonFile) {
        const errorMsg = `No compiled artifact (.json) found in ${targetPath}. Available files: ${
          targetFiles.length > 0
            ? targetFiles.map((f) => f.path).join(', ')
            : 'none'
        }`;
        setAtAddressError(errorMsg);
        console.log('InteractCard - At Address - No .json file found in:', targetPath);
        return;
      }

      const jsonContent = await client.fileManager.readFile(jsonFile.path);
      const artifact = JSON.parse(jsonContent);

      const contract = await Contract.at(address, artifact, wallet);

      const newInstance: ContractInstance = {
        address,
        artifact,
        contract,
      };

      setContractInstances((prev) => {
        if (prev.some((inst) => inst.address.toString() === address.toString())) {
          return prev;
        }
        console.log('InteractCard - At Address - Adding new instance:', newInstance.address.toString());
        return [...prev, newInstance];
      });

      setSelectedInstance(newInstance);
      setAtAddressInput('');
    } catch (error) {
      setAtAddressError(`Failed to load contract at address: ${error.message}`);
    }
  };

  const handleFunctionChange = (e: React.ChangeEvent<any>) => {
    const fnName = e.target.value;
    setSelectedFunction(fnName);
    setCallResult(null);
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev) => {
      const updated = { ...prev, [key]: value };
      return updated;
    });
   
    setSelectedFunction(null);
    setCallResult(null);
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

  const handleCloseCallResult = () => {
    setCallResult(null);
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

  const handleFunctionCall = async (mode: 'simulate' | 'send') => {
    if (!selectedInstance || !selectedFunction || !selectedFunctionAbi) {
      setCallError('Please select a contract instance and function.');
      return;
    }

    setIsLoading(true);
    setCallError(null);
    setCallResult(null);

    try {
      const params = selectedFunctionAbi.abi.parameters.map((param: any) => {
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

      console.log('InteractCard - Function call parameters:', params);

      const method = selectedInstance.contract.methods[selectedFunction];
      if (!method) {
        throw new Error(`Function ${selectedFunction} not found in contract.`);
      }

      if (mode === 'simulate') {
        const result = await method(...params).simulate();
        console.log('InteractCard - Simulate result:', result);
        setCallResult(`Simulation successful: ${JSON.stringify(result, null, 2)}`);
      } else {
        const tx = await method(...params).send();
        const receipt = await tx.wait();
        console.log('InteractCard - Send result:', receipt);
        setCallResult(`Transaction successful: ${JSON.stringify(receipt, null, 2)}`);
      }
    } catch (error) {
      console.error('InteractCard - Function call error:', error);
      setCallError(`Failed to ${mode} function: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredFunctions = Array.isArray(functionAbis)
    ? functionAbis.filter((fn) => {
        const isForbidden = FORBIDDEN_FUNCTIONS.includes(fn.name);
        const isInternal = fn.custom_attributes?.includes('internal') || false;
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

        return !isInternal && !isForbidden && matchesType && matchesSearch;
      })
    : [];

  console.log('InteractCard - Filtered functions:', filteredFunctions);

  const selectedFunctionAbi = functionAbis.find((fn) => fn.name === selectedFunction);

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
              <Form.Group className="mt-3">
                <Form.Label>Contract Instances</Form.Label>
                <InputGroup>
                  <Form.Control
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
                          {inst.address.toString()}
                        </option>
                      ))
                    )}
                  </Form.Control>
                  {selectedInstance && (
                    <Button
                      variant="danger"
                      onClick={() => handleDeleteInstance(selectedInstance.address.toString())}
                    >
                      Delete
                    </Button>
                  )}
                </InputGroup>
              </Form.Group>

              {/* At Address */}
              <Form.Group className="mt-3">
                <Form.Label>At Address</Form.Label>
                <InputGroup>
                  <Form.Control
                    type="text"
                    placeholder="Enter contract address"
                    value={atAddressInput}
                    onChange={(e) => {
                      setAtAddressInput(e.target.value);
                      console.log('InteractCard - At Address input changed:', e.target.value);
                    }}
                  />
                  <Button variant="primary" onClick={handleAtAddress}>
                    At Address
                  </Button>
                </InputGroup>
                {atAddressError && (
                  <Alert variant="danger" className="mt-2 d-flex justify-content-between align-items-center">
                    <span>{atAddressError}</span>
                    <Button variant="link" onClick={handleCloseAtAddressError} className="p-0">
                      <X size={20} />
                    </Button>
                  </Alert>
                )}
              </Form.Group>

              {/* Function Filters */}
              {selectedInstance && (
                <>
                  <Form.Group className="mt-3">
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
                      <Form.Check
                        type="checkbox"
                        label="Private"
                        checked={filters.private}
                        onChange={(e) => handleFilterChange('private', e.target.checked)}
                        className="me-3"
                      />
                      <Form.Check
                        type="checkbox"
                        label="Public"
                        checked={filters.public}
                        onChange={(e) => handleFilterChange('public', e.target.checked)}
                        className="me-3"
                      />
                      <Form.Check
                        type="checkbox"
                        label="Unconstrained"
                        checked={filters.unconstrained}
                        onChange={(e) => handleFilterChange('unconstrained', e.target.checked)}
                      />
                    </div>
                  </Form.Group>

                  {/* Function Selection */}
                  {filteredFunctions.length > 0 ? (
                    <Form.Group className="mt-3">
                      <Form.Label>Select Function</Form.Label>
                      <Form.Control
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
                    </Form.Group>
                  ) : (
                    selectedInstance && (
                      <Alert variant="info" className="mt-3">
                        No functions available to display. Check the contract ABI or adjust the filters.
                      </Alert>
                    )
                  )}

                  {/* Function Parameters */}
                  {selectedFunction && selectedFunctionAbi && (
                    <div className="mt-3">
                      {selectedFunctionAbi.abi.parameters &&
                      selectedFunctionAbi.abi.parameters.length > 0 ? (
                        selectedFunctionAbi.abi.parameters.map((param: any) => (
                          <Form.Group key={param.name} className="mb-2">
                            <Form.Label>{param.name}</Form.Label>
                            <Form.Control
                              type={param.type.kind === 'integer' ? 'number' : 'text'}
                              placeholder={`Enter ${param.name}`}
                              value={callParams[selectedFunction]?.[param.name] || ''}
                              onChange={(e) =>
                                handleParameterChange(selectedFunction, param.name, e.target.value)
                              }
                            />
                          </Form.Group>
                        ))
                      ) : (
                        <p>No parameters for this function.</p>
                      )}
                      {/* Simulate and Send Buttons */}
                      <div className="d-flex gap-2 mt-3">
                        <Button
                          variant="secondary"
                          onClick={() => handleFunctionCall('simulate')}
                          disabled={isLoading}
                        >
                          {isLoading ? 'Loading...' : 'Simulate'}
                        </Button>
                        <Button
                          variant="primary"
                          onClick={() => handleFunctionCall('send')}
                          disabled={isLoading}
                        >
                          {isLoading ? 'Loading...' : 'Send'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Call Result */}
                  {callResult && (
                    <Alert variant="success" className="mt-2 d-flex justify-content-between align-items-center">
                      <pre>{callResult}</pre>
                      <Button variant="link" onClick={handleCloseCallResult} className="p-0">
                        <X size={20} />
                      </Button>
                    </Alert>
                  )}
                </>
              )}

              {callError && (
                <Alert variant="danger" className="mt-2 d-flex justify-content-between align-items-center">
                  <span>{callError}</span>
                  <Button variant="link" onClick={handleCloseCallError} className="p-0">
                    <X size={20} />
                  </Button>
                </Alert>
              )}
            </Form>
          </Card.Body>
        </div>
      </Collapse>
    </Card>
  );
};