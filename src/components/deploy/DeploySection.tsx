import { Form, InputGroup, Button, Alert } from 'react-bootstrap';

interface Parameter {
  name: string;
  type: string;
}

export const DeploySection = ({
  jsonFiles,
  selectedContract,
  setSelectedContract,
  parameters,
  paramValues,
  handleParamChange,
  handleDeploy,
  deploying,
  wallet,
  targetProject,
  deployResult,
  deployError,
}: {
  jsonFiles: string[];
  selectedContract: string;
  setSelectedContract: (v: string) => void;
  parameters: Parameter[];
  paramValues: Record<string, any>;
  handleParamChange: (name: string, value: any) => void;
  handleDeploy: () => void;
  deploying: boolean;
  wallet: any;
  targetProject: string;
  deployResult: string | null;
  deployError: string | null;
}) => {
  return (
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
                {file.split('/').slice(-2).join('/')}
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
            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" /> Deploying...
          </>
        ) : (
          'Deploy'
        )}
      </Button>

      {deployResult && (
        <Alert variant="success" className="mt-2" style={{ fontFamily: 'monospace', fontSize: '12px' }}>
          {deployResult}
        </Alert>
      )}
      {deployError && (
        <Alert variant="danger" className="mt-2" style={{ fontFamily: 'monospace', fontSize: '12px' }}>
          {deployError}
        </Alert>
      )}
    </>
  );
};
