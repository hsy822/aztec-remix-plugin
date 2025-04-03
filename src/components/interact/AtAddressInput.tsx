import React from 'react';
import { Form, InputGroup, OverlayTrigger, Tooltip, Button, Alert } from 'react-bootstrap';
import { X } from 'react-bootstrap-icons';

interface Props {
  atAddressInput: string;
  atAddressError: string | null;
  onChange: (val: string) => void;
  onSubmit: () => void;
  onCloseError: () => void;
}

export const AtAddressInput = ({
  atAddressInput,
  atAddressError,
  onChange,
  onSubmit,
  onCloseError,
}: Props) => {
  return (
    <Form.Group className="mt-3">
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
          <Button variant="primary" size="sm" className="px-3" onClick={onSubmit}>
            At Address
          </Button>
        </OverlayTrigger>

        <OverlayTrigger placement="top" overlay={<Tooltip>Address of Contract</Tooltip>}>
          <Form.Control
            type="text"
            placeholder="contract address"
            value={atAddressInput}
            onChange={(e) => onChange(e.target.value)}
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
            <div>{atAddressError}</div>
            <Button
              variant="link"
              onClick={onCloseError}
              className="p-0 ms-2"
              style={{ lineHeight: 1 }}
            >
              <X size={20} />
            </Button>
          </div>
        </Alert>
      )}
    </Form.Group>
  );
};
