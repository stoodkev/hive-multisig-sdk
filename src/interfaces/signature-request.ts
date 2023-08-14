import { KeychainKeyTypes } from 'hive-keychain-commons';
import { Signer } from './signer';

export interface SignatureRequest {
  id: number;
  expirationDate: Date;
  threshold: number;
  keyType: KeychainKeyTypes;
  initiator: string;
  locked: boolean;
  broadcasted?: boolean;
  createdAt?:Date;
  updatedAt?:Date;
  signers: Signer[];
}
