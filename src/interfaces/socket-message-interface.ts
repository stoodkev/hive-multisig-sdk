import { SignedTransaction, Transaction } from '@hiveio/dhive';
import { KeychainKeyTypes } from 'hive-keychain-commons';
import { SignatureRequest } from './signature-request';
import { Signer } from './signer';

export enum SocketMessageCommand {
  SIGNER_CONNECT = 'signer_connect',
  REQUEST_SIGNATURE = 'request_signature',
  REQUEST_SIGN_TRANSACTION = 'request_sign_transaction',
  SIGN_TRANSACTION = 'sign_transaction',
  REQUEST_LOCK = 'request_lock',
  NOTIFY_TRANSACTION_BROADCASTED = 'notify_transaction_broadcasted',
  TRANSACTION_BROADCASTED_NOTIFICATION = 'transaction_broadcasted_notification',
}
export interface MultisigOptions {
  socketAddress: string;
  clientAddress: string;
  apiAddress: string;
}
export interface SocketMessage {
  command: string;
  payload: SocketMessagePayload;
}

export interface NotifyTxBroadcastedMessage extends SocketMessagePayload {
  signatureRequestId: number;
}

export interface SocketMessagePayload {}

export interface SignerConnectMessage extends SocketMessagePayload {
  publicKey?: string;
  message?: string;
  username: string;
  keyType: KeychainKeyTypes;
}

export interface SignerConnectResponse {
  errors?: SignerConnectError;
  result?: SignerConnectResult;
  message?: string;
  publicKey?: string;
}

export interface SignerConnectResult {
  pendingSignatureRequests?: UserPendingSignatureRequest;
  notifications?: UserNotifications;
}

export interface UserNotifications {
  [username: string]: UserNotification[];
}
export interface UserPendingSignatureRequest {
  [username: string]: SignatureRequest[];
}

export interface UserNotification {
  message: string;
  signatureRequest: SignatureRequest;
}
export interface SignerConnectError {
  [username: string]: string;
}

export interface ISignatureRequest {
  expirationDate: Date | string;
  threshold: number;
  keyType: KeychainKeyTypes;
  signers: RequestSignatureSigner[];
}

export interface SignatureRequestInitialSigner {
  username: string;
  publicKey: string;
  signature: string;
  weight: number;
}

export interface RequestSignatureMessage extends SocketMessagePayload {
  signatureRequest: ISignatureRequest;
  initialSigner: SignatureRequestInitialSigner;
}

export interface RequestSignatureSigner {
  encryptedTransaction: string; // Encrypted transaction with signer key
  publicKey: string; // public key of signer
  weight: string;
  metaData?: RequestSignatureSignerMetadata | undefined;
}

export interface RequestSignatureSignerMetadata {
  twoFACodes?: TwoFACodes;
}
export interface SignTransactionMessage extends SocketMessagePayload {
  signature: string;
  signerId: number;
  signatureRequestId: number;
}

export interface RefuseTransactionMessage extends SocketMessagePayload {
  signerId: number;
}

export interface ISignTransaction {
  decodedTransaction: Transaction;
  signerId: number;
  signatureRequestId: number;
  username: string;
  method: KeychainKeyTypes;
}

export interface IEncodeTransaction {
  transaction: Transaction;
  method: KeychainKeyTypes;
  expirationDate: Date | string;
  initiator: {
    username: string;
    publicKey: string;
    weight: number;
  };
}

export interface IDecodeTransaction {
  signatureRequest: SignatureRequest[];
  username: string;
}

export interface ITransaction {
  signer: Signer;
  signatureRequestId: number;
  transaction: SignedTransaction;
  method: KeychainKeyTypes;
  username: string;
}

export interface TwoFACodes {
  [botName: string]: string;
}
export type SignatureRequestCallback = (message: SignatureRequest) => void;
