import { useState } from 'react';
import { Collapse, Card, Alert } from 'react-bootstrap';
import { ChevronDown, ChevronUp } from 'react-bootstrap-icons';
import type { InterfaceProps } from '../types';

export const InteractCard = ({ client }: InterfaceProps) => {
  const [openDeploy, setOpenDeploy] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);

  return (
    <Card className="mb-3">
      <Card.Header
        onClick={() => setOpenDeploy(!openDeploy)}
        aria-controls="deploy-collapse"
        aria-expanded={openDeploy}
        className="d-flex align-items-center justify-content-between"
        style={{ cursor: 'pointer' }}
      >
        <div className="d-flex align-items-center">Interact</div>
        {openDeploy ? <ChevronUp /> : <ChevronDown />}
      </Card.Header>
      <Collapse in={openDeploy}>
        <div id="deploy-collapse" style={{ transition: 'height 0.3s ease-in-out', overflow: 'hidden' }}>
          <Card.Body>
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>
              Deploy your contract here.
            </p>
            {deployError && <Alert variant="danger" className="mt-2">{deployError}</Alert>}
          </Card.Body>
        </div>
      </Collapse>
    </Card>
  );
};