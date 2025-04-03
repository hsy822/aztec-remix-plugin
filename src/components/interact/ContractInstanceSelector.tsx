import React from 'react';
import { Form, InputGroup, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { Clipboard, Trash } from 'react-bootstrap-icons';
import { AztecAddress } from '@aztec/aztec.js';
import { copyToClipboard } from '../../utils/clipboard';

interface Props {
  contractInstances: { address: AztecAddress }[];
  selectedInstance: { address: AztecAddress } | null;
  onSelect: (address: string) => void;
  onDelete: (address: string) => void;
}

export const ContractInstanceSelector = ({
  contractInstances,
  selectedInstance,
  onSelect,
  onDelete,
}: Props) => {
  const shortenAddress = (addr: string) => {
    return addr.length > 12 ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : addr;
  };

  return (
    <Form.Group>
      <Form.Label>Contract Instances</Form.Label>
      <InputGroup className="mt-2">
        <Form.Control
          className="custom-select"
          as="select"
          value={selectedInstance?.address.toString() || ''}
          onChange={(e) => onSelect(e.target.value)}
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
              <span style={{ cursor: 'pointer' }} onClick={() => onDelete(selectedInstance.address.toString())}>
                <Trash />
              </span>
            </OverlayTrigger>
          </>
        )}
      </InputGroup>
    </Form.Group>
  );
};
