import { KeychainKeyTypes } from 'hive-keychain-commons';
import { SignatureRequest } from './signature-request';
import { KeychainOptions } from 'keychain-sdk';
import { Signature, Transaction } from '@hiveio/dhive';
import * as Hive from '@hiveio/dhive';

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
  keychainOptions?: KeychainOptions;
  socketAddress: string;
  clientAddress: string;
}
export interface SocketMessage {
  command: string;
  payload: SocketMessagePayload;
}

export interface SocketMessagePayload {}

export interface NotifyTxBroadcastedMessage extends SocketMessagePayload {
  signatureRequestId: number;
}

export interface SignerConnect {
  username: string;
  keyType: KeychainKeyTypes;
}
export interface SignerConnectMessage extends SocketMessagePayload {
  publicKey: string;
  message: string;
  username: string;
}

export interface SignerConnectResponse {
  errors?: SignerConnectError;
  result?: SignerConnectResult;
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
  expirationDate: Date;
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
  publicKey: string;
  weight: string;
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
  expirationDate: Date;
  initiator: string|Hive.PublicKey;
  receiver: string|Hive.PublicKey;
  authority: Hive.Authority
}

export interface IDecodeTransaction {
  signatureRequest: SignatureRequest;
  username: string;
  publicKey: string;
}
export type SignatureRequestCallback = (message: SignatureRequest) => void;
