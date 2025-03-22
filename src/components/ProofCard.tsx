import { useState } from 'react';
import { Collapse, Card, Alert } from 'react-bootstrap';
import { ChevronDown, ChevronUp } from 'react-bootstrap-icons';
import type { InterfaceProps } from '../types';

export const ProofCard = ({ client }: InterfaceProps) => {
  const [openInteract, setOpenInteract] = useState(false);
  const [interactError, setInteractError] = useState<string | null>(null);

  return (
    <Card className="mb-3">
      <Card.Header
        onClick={() => setOpenInteract(!openInteract)}
        aria-controls="interact-collapse"
        aria-expanded={openInteract}
        className="d-flex align-items-center justify-content-between"
        style={{ cursor: 'pointer' }}
      >
        <div className="d-flex align-items-center">Proof</div>
        {openInteract ? <ChevronUp /> : <ChevronDown />}
      </Card.Header>
      <Collapse in={openInteract}>
        <div id="interact-collapse" style={{ transition: 'height 0.3s ease-in-out', overflow: 'hidden' }}>
          <Card.Body>
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>
              Interact with your deployed contract.
            </p>
            {interactError && <Alert variant="danger" className="mt-2">{interactError}</Alert>}
          </Card.Body>
        </div>
      </Collapse>
    </Card>
  );
};