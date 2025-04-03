import React from 'react';
import { Form, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { ArrowRepeat } from 'react-bootstrap-icons';

interface Props {
  useAuthwit: boolean;
  onToggle: (val: boolean) => void;
  selectedAlias: string;
  savedAliases: string[];
  onAliasChange: (alias: string) => void;
  onReload: () => void;
}

export const AuthWitnessSelector = ({
  useAuthwit,
  onToggle,
  selectedAlias,
  savedAliases,
  onAliasChange,
  onReload,
}: Props) => {
  return (
    <>
      <Form.Check
        type="switch"
        id="use-authwit-switch"
        label={
          <OverlayTrigger placement="top" overlay={<Tooltip>Send will include the selected AuthWitness.</Tooltip>}>
            <span>Use AuthWitness</span>
          </OverlayTrigger>
        }
        checked={useAuthwit}
        onChange={(e) => onToggle(e.target.checked)}
        className="mt-3 mb-2"
      />

      {useAuthwit && (
        <Form.Group className="mb-3">
          <Form.Label>Select AuthWitness Alias</Form.Label>
          <OverlayTrigger placement="top" overlay={<Tooltip>Reload</Tooltip>}>
            <span style={{ cursor: 'pointer', marginLeft: '3px' }} onClick={onReload}>
              <ArrowRepeat />
            </span>
          </OverlayTrigger>
          <Form.Control
            as="select"
            value={selectedAlias}
            onChange={(e) => onAliasChange(e.target.value)}
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
    </>
  );
};
