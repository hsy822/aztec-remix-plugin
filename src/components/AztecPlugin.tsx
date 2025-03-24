import { Badge } from 'react-bootstrap';
import { EnvironmentCard } from './EnvironmentCard';
import { CompileDeployCard } from './CompileDeployCard';
import { InteractCard } from './InteractCard';
import { ProofCard } from './ProofCard';
import type { InterfaceProps } from '../types';

export const AztecPlugin = ({ client }: InterfaceProps) => {
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-2 mt-2">
        <Badge bg="warning" text="dark">
          ALPHA
        </Badge>
      </div>
      <EnvironmentCard client={client} />
      <CompileDeployCard client={client} />
      <InteractCard client={client} />
      {/* <ProofCard client={client} /> */}
    </>
  );
};