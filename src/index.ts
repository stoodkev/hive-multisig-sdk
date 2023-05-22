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
} from './interfaces/multisig-backend/socket-message.interface';
import { KeychainOptions, KeychainSDK, SignBuffer } from 'keychain-sdk';
import { Socket, io } from 'socket.io-client';
import { KeychainKeyTypes } from 'hive-keychain-commons';
import { rejects } from 'assert';
import { resolve } from 'path';
import { HiveUtils } from './utils/hive.utils';
import { PublicKey, Signature, cryptoUtils } from '@hiveio/dhive';

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
        SocketAddress: 'http://localhost:5001',
        ClientAddress: 'https://api.deathwing.me',
      };
    } else {
      this.options = options;
    }
    this.socket = io(this.options.SocketAddress);
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
    to: string,
    keyType: KeychainKeyTypes,
  ): Promise<SignerConnectResponse> => {
    return new Promise(async (resolve, reject) => {
      try {
        const signBuffer = await this.keychain.signBuffer({
          username: to,
          message: to,
          method: keyType,
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
                reject(signerConnectResponse);
              }
              resolve(signerConnectResponse);
            },
          );
        } else {
          reject('Error while signing buffer');
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
   *
   * @example
   * import {HiveMultisigSDK} from "hive-multisig-sdk";
   * const multisig = new HiveMultisigSDK(window);
   *
   *
   * @param message
   *
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

  verifyKey = async (message: SignerConnectMessage): Promise<boolean> => {
    return new Promise(async (resolve, reject) => {
      HiveUtils.getClient()
        .keys.getKeyReferences([message.publicKey!])
        .then((result) => {
          if (result.accounts?.[0]?.includes(message.username)) {
            const signature = Signature.fromString(message.message);
            const key = PublicKey.fromString(message.publicKey);
            if (key.verify(cryptoUtils.sha256(message.username), signature)) {
              return true;
            }
            throw new Error('The signature could not be verified');
          }
          throw new Error('The signature could not be verified');
        });
    });
  };

  ping = async (setPong: Function): Promise<string> => {
    this.socket.on('pong', () => {
      setPong(new Date().toISOString());
    });
    return new Promise(async (resolve, reject) => {
      try {
        this.socket.emit('ping', (response: string) => {
          console.log(response);
          resolve(response);
        });
      } catch (error: any) {
        reject(new Error('Error during ping.'));
      }
    });
  };
}
