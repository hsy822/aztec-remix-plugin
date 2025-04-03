import React from 'react';
import { Form, InputGroup, Alert } from 'react-bootstrap';

interface Props {
  filteredFunctions: any[];
  selectedFunction: string | null;
  onChange: (fnName: string) => void;
}

export const FunctionSelector = ({ filteredFunctions, selectedFunction, onChange }: Props) => {
  if (filteredFunctions.length === 0) {
    return (
      <Alert variant="info" className="mt-3" style={{
        fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize: '12px',
      }}>
        No functions available to display. Check the contract ABI or adjust the filters.
      </Alert>
    );
  }

  return (
    <Form.Group className="mt-3">
      <Form.Label>Select Function</Form.Label>
      <InputGroup className="mt-2">
        <Form.Control
          className="custom-select"
          as="select"
          value={selectedFunction || ''}
          onChange={(e) => onChange(e.target.value)}
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
            const displayTags = [functionType, isUnconstrained ? 'unconstrained' : '', additionalTags]
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
  );
};
