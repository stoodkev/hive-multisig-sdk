import * as Hive from '@hiveio/dhive';
import { SignatureRequest } from './signature-request';

export interface Signer {
  id: number;
  publicKey: string;
  encryptedTransaction: string;
  weight: number;
  signature?: string;
  refused?: boolean;
  notified?: boolean;
}

export interface Authorities {
  account: string;
  owner: Hive.AuthorityType;
  active: Hive.AuthorityType;
  posting: Hive.AuthorityType;
  memo_key: string | Hive.PublicKey;
  json_metadata: string;
}
