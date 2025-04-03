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
import { ContractInstanceSelector } from './interact/ContractInstanceSelector';
import { AtAddressInput } from './interact/AtAddressInput';
import { FunctionFilter } from './interact/FunctionFilter';
import { FunctionSelector } from './interact/FunctionSelector';
import { FunctionParametersForm } from './interact/FunctionParametersForm';
import { AuthWitnessSelector } from './interact/AuthWitnessSelector';
import { ActionButtons } from './interact/ActionButtons';
import { AuthwitCreationForm } from './interact/AuthwitCreationForm';

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

  const handleInstanceChange = (address: string) => {
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
  

  const handleFunctionChange = async (fnName: string) => {
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
        await loadSavedAuthwitAliases(); 
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
              <ContractInstanceSelector
                contractInstances={contractInstances}
                selectedInstance={selectedInstance}
                onSelect={handleInstanceChange}
                onDelete={handleDeleteInstance}
              />

              {/* At Address */}
              <AtAddressInput
                atAddressInput={atAddressInput}
                atAddressError={atAddressError}
                onChange={setAtAddressInput}
                onSubmit={handleAtAddress}
                onCloseError={handleCloseAtAddressError}
              />

              {/* Function Filters */}
              {selectedInstance && (
                <>
                  <FunctionFilter
                    filters={filters}
                    onFilterChange={handleFilterChange}
                  />

                  <FunctionSelector
                    filteredFunctions={filteredFunctions}
                    selectedFunction={selectedFunction}
                    onChange={handleFunctionChange}
                  />

                  {selectedFunction && selectedFunctionAbi && (
                    <>
                      <FunctionParametersForm
                        fnAbi={selectedFunctionAbi}
                        fnName={selectedFunction}
                        callParams={callParams}
                        onParamChange={handleParameterChange}
                      />

                      <AuthWitnessSelector
                        useAuthwit={useAuthwit}
                        onToggle={setUseAuthwit}
                        selectedAlias={selectedAlias}
                        savedAliases={savedAliases}
                        onAliasChange={setSelectedAlias}
                        onReload={loadSavedAuthwitAliases}
                      />

                      <ActionButtons
                        isSimulating={isSimulating}
                        isSending={isSending}
                        selectedFunctionAbi={selectedFunctionAbi}
                        onSimulate={() => handleFunctionCall('simulate')}
                        onSend={() => handleFunctionCall('send')}
                        onToggleAuthwit={() => setShowAuthwitForm(prev => !prev)}
                      />

                      {showAuthwitForm && (
                        <AuthwitCreationForm
                          caller={caller}
                          alias={alias}
                          creating={creatingAuthwit}
                          onChangeCaller={setCaller}
                          onChangeAlias={setAlias}
                          onCreate={handleCreateAuthwit}
                        />
                      )}
                    </>
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