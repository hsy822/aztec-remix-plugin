import React from 'react';
import { Button } from 'react-bootstrap';

interface Props {
  isSimulating: boolean;
  isSending: boolean;
  selectedFunctionAbi: any;
  onSimulate: () => void;
  onSend: () => void;
  onToggleAuthwit: () => void;
}

export const ActionButtons = ({
  isSimulating,
  isSending,
  selectedFunctionAbi,
  onSimulate,
  onSend,
  onToggleAuthwit,
}: Props) => {
  const isView = selectedFunctionAbi?.custom_attributes?.includes('view');

  return (
    <div className="d-flex mt-3 flex-wrap w-100">
      <Button
        variant="primary"
        size="sm"
        onClick={onSimulate}
        disabled={isSimulating}
        className="flex-grow-1 me-2"
        style={{ marginRight: '5px' }}
      >
        Simulate
      </Button>

      <Button
        variant="primary"
        size="sm"
        onClick={onSend}
        disabled={isSending || isView}
        className="flex-grow-1 me-2"
        style={{ marginRight: '5px' }}
      >
        Send
      </Button>

      <Button
        variant="secondary"
        size="sm"
        onClick={onToggleAuthwit}
        className="flex-grow-1"
      >
        AuthWit
      </Button>
    </div>
  );
};
