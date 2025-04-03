import React from 'react';
import { Form } from 'react-bootstrap';

interface Props {
  fnAbi: any;
  fnName: string;
  callParams: Record<string, Record<string, any>>;
  onParamChange: (fnName: string, paramName: string, value: any) => void;
}

export const FunctionParametersForm = ({ fnAbi, fnName, callParams, onParamChange }: Props) => {
  const parameters = fnAbi?.abi?.parameters || [];
  const isPrivate = fnAbi?.custom_attributes?.includes('private');

  const filteredParams = parameters.filter((param: any, index: number) => {
    return !(isPrivate && index === 0 && param.name === 'inputs');
  });

  if (filteredParams.length === 0) {
    return <p>No parameters for this function.</p>;
  }

  return (
    <>
      {filteredParams.map((param: any) => (
        <Form.Group key={param.name} className="mb-2" style={{ marginTop: '10px' }}>
          <Form.Label>{param.name}</Form.Label>
          <Form.Control
            type={param.type.kind === 'integer' ? 'number' : 'text'}
            placeholder={`Enter ${param.name}`}
            value={callParams[fnName]?.[param.name] || ''}
            onChange={(e) => onParamChange(fnName, param.name, e.target.value)}
          />
        </Form.Group>
      ))}
    </>
  );
};
