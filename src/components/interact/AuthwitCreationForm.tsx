import React from 'react';
import { Form, Button } from 'react-bootstrap';

interface Props {
  caller: string;
  alias: string;
  creating: boolean;
  onChangeCaller: (val: string) => void;
  onChangeAlias: (val: string) => void;
  onCreate: () => void;
}

export const AuthwitCreationForm = ({
  caller,
  alias,
  creating,
  onChangeCaller,
  onChangeAlias,
  onCreate,
}: Props) => {
  return (
    <div className="mt-3 p-3 border rounded bg-light">
      <Form.Group className="mb-2">
        <Form.Label>Caller Address (Aztec Address)</Form.Label>
        <Form.Control
          type="text"
          placeholder="Enter caller address"
          value={caller}
          onChange={(e) => onChangeCaller(e.target.value)}
        />
      </Form.Group>

      <Form.Group className="mb-2">
        <Form.Label>Alias</Form.Label>
        <Form.Control
          type="text"
          placeholder="Enter alias for this AuthWitness"
          value={alias}
          onChange={(e) => onChangeAlias(e.target.value)}
        />
      </Form.Group>

      <Button
        variant="warning"
        size="sm"
        disabled={!caller || !alias || creating}
        onClick={onCreate}
      >
        Create
      </Button>
    </div>
  );
};
