import {
  SocketMessageCommand,
  SocketMessage,
  SocketMessagePayload,
  NotifyTxBroadcastedMessage,
  SignerConnectMessage,
  SignerConnectResponse,
  SignerConnectResult,
  UserNotifications,
  UserPendingSignatureRequest,
  UserNotification,
  SignerConnectError,
  SignatureRequestInitialSigner,
  RequestSignatureMessage,
  RequestSignatureSigner,
  SignTransactionMessage,
  RefuseTransactionMessage,
  MultisigOptions,
  SignatureRequestCallback,
  ISignTransaction,
  IEncodeTransaction,
  SignerConnect,
  IDecodeTransaction,
} from './interfaces/socket-message.interface';
import { KeychainSDK, SignBuffer } from 'keychain-sdk';
import { Socket, io } from 'socket.io-client';
import { KeychainKeyTypes } from 'hive-keychain-commons';
import { HiveUtils } from './utils/hive.utils';
import { PublicKey, Signature, Transaction, cryptoUtils } from '@hiveio/dhive';
import { SignatureRequest } from './interfaces/signature-request';
import { Authority } from '@hiveio/dhive';

/**
 * @description
 * Contains utils methods to perform transactions requiring multiple signatures.
 *
 * @example
 * @export
 * @class
 */
export class HiveMultisigSDK {
  window: Window;
  options?: MultisigOptions;
  keychain: KeychainSDK;
  socket: Socket;
  constructor(window: Window, options?: MultisigOptions) {
    this.window = window;
    this.keychain = new KeychainSDK(this.window);
    if (!options) {
      this.options = {
        socketAddress: 'http://localhost:5001',
        clientAddress: 'https://api.deathwing.me',
      };
    } else {
      this.options = options;
    }
    this.socket = io(this.options.socketAddress);
  }

  /**
   * @description
   * This function is called to connect to a single account or key before making a multi-signature transaction.
   *
   * Under the hood, this function will call the window.hive_keychain.requestSignBuffer() using KeychainSDK.
   *
   * @example
   * import {HiveMultisigSDK} from "hive-multisig-sdk";
   * const multisig = new HiveMultisigSDK(window);
   * const username = 'hive.user';
   * try {
   *       const signerConnectResponse = await multisig.singleSignerConnect(
   *           username,
   *           KeychainKeyTypes.posting,
   *       );
   *       console.log({ signerConnectResponse });
   *   } catch (error) {
   *       console.log(error);
   *   }
   * @param to username or key
   * @param keyType KeychainKeyTypes
   * @returns SignerConnectResponse
   */

  singleSignerConnect = async (
    signer: SignerConnect,
  ): Promise<SignerConnectResponse> => {
    return new Promise(async (resolve, reject) => {
      try {
        const signBuffer = await this.keychain.signBuffer({
          username: signer.username,
          message: signer.username,
          method: signer.keyType,
          title: 'Send Signer Connect Message',
        } as SignBuffer);

        if (signBuffer.success) {
          const signerConnectParams: SignerConnectMessage = {
            publicKey: signBuffer.publicKey!,
            message: JSON.stringify(signBuffer.result).replace(`"`, ''),
            username: signBuffer.data.username,
          };
          this.socket.emit(
            SocketMessageCommand.SIGNER_CONNECT,
            [signerConnectParams],
            (signerConnectResponse: SignerConnectResponse) => {
              if (signerConnectResponse.errors) {
                reject(signerConnectResponse.errors);
              }
              resolve(signerConnectResponse);
            },
          );
        } else {
          reject(
            new Error('Error while signing buffer during singleSignerConnect'),
          );
        }
      } catch (error: any) {
        const errorMessage =
          'Error occurred during singleSignerConnect: ' + error.message;
        reject(new Error(errorMessage));
      }
    });
  };

  /**
   * @description
   * This function is called to connect to multiple accounts or keys before making a multi-signature transaction.
   *
   * Unlike singleSignerConnect, it is required to sign each message using KeychainSDK.signBuffer() first outside of this function.
   *
   * @param messages array of signed connect messages
   * @returns SignerConnectResponse
   */
  multipleSignerConnect = async (
    messages: SignerConnectMessage[],
  ): Promise<SignerConnectResponse> => {
    return new Promise(async (resolve, reject) => {
      try {
        this.socket.emit(
          SocketMessageCommand.SIGNER_CONNECT,
          messages,
          (signerConnectResponse: SignerConnectResponse) => {
            if (signerConnectResponse.errors) {
              reject(signerConnectResponse);
            }
            resolve(signerConnectResponse);
          },
        );
      } catch (error: any) {
        const errorMessage =
          'Error occurred during multipleSignerConnect: ' + error.message;
        reject(new Error(errorMessage));
      }
    });
  };

  /**
   * @description
   * A function tha returns the account authorities that are required to sign for the multisig transaction
   *
   * @param username
   * @param keyType the transaction key type or method
   * @returns Authority - containing the list of accounts and keys as well as the corresponding weights and weight threshold
   */
  getSigners = async (
    username: string,
    keyType: KeychainKeyTypes,
  ): Promise<Authority> => {
    return new Promise(async (resolve, reject) => {
      try {
        const account = await HiveUtils.getAccount(username);
        if (account.length === 0) {
          reject(`${username} not found`);
        }
        switch (keyType) {
          case KeychainKeyTypes.active:
            resolve(account[0].active);
          case KeychainKeyTypes.posting:
            resolve(account[0].posting);
        }
      } catch (error) {
        reject(new Error('error occured during getSigners: ' + error.message));
      }
    });
  };

  /**
   * @description
   *
   *
   *
   * @param message
   * @return
   */
  sendSignatureRequest = async (
    message: RequestSignatureMessage,
  ): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        this.socket.emit(
          SocketMessageCommand.REQUEST_SIGNATURE,
          message,
          (response: string) => {
            resolve(response);
          },
        );
      } catch (error: any) {
        const errorMessage =
          'Error occured during sendSignatureRequest: ' + error.message;
        reject(new Error(errorMessage));
      }
    });
  };

  /**
   * @description
   *
   * @param message .
   * @returns.
   */
  signTransaction = async (data: ISignTransaction): Promise<string[]> => {
    return new Promise(async (resolve, reject) => {
      try {
        const signature = await this.keychain.signTx({
          username: data.username,
          tx: data.decodedTransaction,
          method: data.method,
        });
        if (signature.success) {
          try {
            const signedTransaction = signature.result;
            const signTransactionMessage: SignTransactionMessage = {
              signature:
                signedTransaction.signatures[
                  signedTransaction.signatures.length - 1
                ],
              signerId: data.signerId,
              signatureRequestId: data.signatureRequestId,
            };
            this.socket.emit(
              SocketMessageCommand.SIGN_TRANSACTION,
              signTransactionMessage,
              (response: string[]) => {
                resolve(response);
              },
            );
          } catch (error: any) {
            reject(
              new Error(
                'Error occured during signTransaction: ' + error.message,
              ),
            );
          }
        }
        reject(signature.error);
      } catch (error: any) {
        reject(
          new Error('Error occured during signTransaction: ' + error.message),
        );
      }
    });
  };

  /**
   * @description
   * Notifies the backend about a transaction being broadcasted.
   *
   * @param message The NotifyTxBroadcastedMessage containing signatureRequestId.
   * @returns A Promise that resolves with a string message indicating successful notification.
   */
  notifyTransactionBroadcasted = async (
    message: NotifyTxBroadcastedMessage,
  ): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        this.socket.emit(
          SocketMessageCommand.NOTIFY_TRANSACTION_BROADCASTED,
          message,
          () => {
            resolve('Backend has been notified of broadcast.');
          },
        );
      } catch (error: any) {
        reject(
          new Error(
            'Error occured during notifyTransactionBroadcased: ' +
              error.message,
          ),
        );
      }
    });
  };

  /**
   * @description
   * Encodes the transaction data using the keychain.
   *
   * @param data The object containing transaction encoding details.
   * @returns A Promise that resolves with the encoded transaction as a string.
   */
  encodeTransaction = (data: IEncodeTransaction): Promise<string> => {
    return new Promise<string>(async (resolve, reject) => {
      try {
        const signature = await this.keychain.signTx({
          username: data.username,
          tx: data.transaction,
          method: data.method,
        });

        if (!signature.success) {
          reject(
            new Error('Failed to sign transaction during transaction encoding'),
          );
          return;
        }
        const signedTransaction = signature.result;
        const encodedTransaction = await this.keychain.encode({
          username: data.username,
          receiver: data.receiver,
          message: `#${JSON.stringify(signedTransaction)}`,
          method: data.method,
        });

        if (!encodedTransaction.success) {
          reject(new Error('Failed to encode transaction'));
          return;
        }

        resolve(encodedTransaction.message);
      } catch (error: any) {
        reject(
          new Error(
            'Error occurred during encodeTransaction: ' + error.message,
          ),
        );
      }
    });
  };

  /**
   * @description
   * Decodes the encrypted transaction for the signature request.
   *
   * @param signatureRequest
   * @param username
   * @param publicKey
   * @returns A Promise that resolves with the decoded transaction as a Transaction object.
   */
  decodeTransaction = async (
   data: IDecodeTransaction
  ): Promise<Transaction> => {
    return new Promise(async (resolve, reject) => {
      if (!data.signatureRequest) {
        reject(
          new Error(
            'You passed an empty signatureRequest in decodeTransaction.',
          ),
        );
      }
      const signer = data.signatureRequest.signers.find(
        (s) => s.publicKey === data.publicKey,
      );
      if (!signer) {
        reject(
          new Error('The publikKey cannot be found in the list of signers.'),
        );
      }
      try {
        const decodedTx = await this.keychain.decode({
          username: data.username,
          message: signer.encryptedTransaction,
          method: data.signatureRequest.keyType,
        });
        if (decodedTx.success) {
          const data = JSON.stringify(decodedTx.result).replace('#', '');
          if (typeof data === 'object' && data !== null) {
            resolve(JSON.parse(data) as Transaction);
          }
          reject(
            new Error(
              'Cannot parse transaction string. Invalid transaction format.',
            ),
          );
        }
      } catch (error: any) {
        reject(
          new Error(
            'An error occured during decodeTransaction: ' + error.message,
          ),
        );
      }
    });
  };

  /**
   * @description
   * Verifies the key and signature of a signer's connection message.
   *
   * @param message The signer connection message containing the public key, username, and signature.
   * @returns A Promise that resolves with a boolean indicating whether the key and signature are valid.
   */
  verifyKey = async (message: SignerConnectMessage): Promise<boolean> => {
    return new Promise(async (resolve, reject) => {
      HiveUtils.getClient()
        .keys.getKeyReferences([message.publicKey!])
        .then((result) => {
          if (result.accounts?.[0]?.includes(message.username)) {
            const signature = Signature.fromString(message.message);
            const key = PublicKey.fromString(message.publicKey);
            if (key.verify(cryptoUtils.sha256(message.username), signature)) {
              resolve(true);
            }
            reject(new Error('The signature could not be verified'));
          }
          reject(new Error('The signature could not be verified'));
        });
    });
  };

  /**
   * @description
   * Subscribes to signature requests and invokes the provided callback function when a signature request is received.
   *
   * @param callback The callback function to be invoked with the signature request.
   * @returns A Promise that resolves with a string message indicating successful subscription.
   */
  subscribeToSignRequests = (
    callback: SignatureRequestCallback,
  ): Promise<boolean> => {
    return new Promise<boolean>((resolve, reject) => {
      try {
        this.socket.on(
          SocketMessageCommand.REQUEST_SIGN_TRANSACTION,
          (signatureRequest: SignatureRequest) => {
            callback(signatureRequest);
          },
        );
        resolve(true);
      } catch (error: any) {
        reject(
          new Error(
            'Error occured when trying to subscribe to signer requests: ' +
              error.message,
          ),
        );
      }
    });
  };

  /**
   * @description
   * Subscribes to broadcasted transactions and invokes the provided callback function when a transaction has been broadcasted.
   *
   * @param callback The callback function to be invoked with the signature request.
   * @returns A Promise that resolves with a string message indicating successful subscription.
   */
  subscribeToBroadcastedTransactions = (
    callback: SignatureRequestCallback,
  ): Promise<boolean> => {
    return new Promise<boolean>((resolve, reject) => {
      try {
        this.socket.on(
          SocketMessageCommand.TRANSACTION_BROADCASTED_NOTIFICATION,
          (signatureRequest: SignatureRequest) => {
            callback(signatureRequest);
          },
        );
        resolve(true);
      } catch (error: any) {
        reject(
          new Error(
            'Error occured when trying to subscribe to broadcasted transactions: ' +
              error.message,
          ),
        );
      }
    });
  };
}
