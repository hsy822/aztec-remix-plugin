import React, { useState, useEffect } from 'react';
import { Container } from 'react-bootstrap';
import { AztecPlugin } from './components/AztecPlugin'; // Main -> AztecPlugin으로 변경
import type { Api } from '@remixproject/plugin-utils';
import { createClient } from '@remixproject/plugin-iframe';
import type { IRemixApi } from '@remixproject/plugin-api';
import type { Client } from '@remixproject/plugin';
import { AztecProvider } from './AztecProvider';

function App() {
  const [client, setClient] = useState<Client<Api, Readonly<IRemixApi>> | undefined | null>(null);
  const [connection, setConnection] = useState<boolean>(false);

  useEffect(() => {
    const init = async () => {
      const temp = createClient();
      await temp.onload();
      setClient(temp);
      setConnection(true);
    };
    if (!connection) init();
    console.debug(`%cẅël̈l̈c̈öm̈ë-̈ẗö-̈äz̈ẗëc̈-̈p̈l̈üg̈ïn̈!̈`, 'color:yellow');
  }, []);

  return (
    <div className="App">
      <Container>{client && 
        <AztecProvider>
          <AztecPlugin client={client} />
        </AztecProvider>}
      </Container>
    </div>
  );
}

export default App;