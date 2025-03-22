import type { Client } from '@remixproject/plugin';
import type { Api } from '@remixproject/plugin-utils';
import type { IRemixApi } from '@remixproject/plugin-api';

export interface InterfaceProps {
  client: Client<Api, Readonly<IRemixApi>>;
}

export interface FileInfo {
  path: string;
  isDirectory: boolean;
}