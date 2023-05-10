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
   * @example
   * import {HiveMultisigSDK} from "hive-multisig-sdk";
   * const multisig = new HiveMultisigSDK(window);
   * const username = 'hive.user';
   * try {
   *       const signerConnectResponse = multisig.signerConnectMessage(
   *           username,
   *           KeychainKeyTypes.posting,
   *       );
   *       console.log({ signerConnectResponse });
   *   } catch (error) {
   *       console.log(error);
   *   }
   * @param to username or key
   * @param keyType KeychainKeyTypes
   * @returns
   */

  signerConnectMessage = async (
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
            publicKey: signBuffer.publicKey,
            message: JSON.stringify(signBuffer.result),
            username: signBuffer.data.username,
          };
          this.socket.emit(SocketMessageCommand.SIGNER_CONNECT, [
            signerConnectParams,
            (signerConnectResponse: SignerConnectResponse) => {
              if (signerConnectResponse.errors) {
                reject(signerConnectResponse);
              } else {
                resolve(signerConnectResponse);
              }
            },
          ]);
        } else {
          reject('error while signing buffer');
        }
      } catch (error) {
        throw error;
      }
    });
  };
}
