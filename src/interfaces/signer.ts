import { SignatureRequest } from "./signature-request";

export class Signer {
  id: number;
  publicKey: string;
  encryptedTransaction: string;
  weight: number;
  signature?: string;
  refused?: boolean;
  notified?: boolean;
  signatureRequest: SignatureRequest;
}
