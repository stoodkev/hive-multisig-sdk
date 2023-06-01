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
  DecodedTransactionMessage,
  DecodedTransaction,
  ISignTransaction,
} from './interfaces/socket-message.interface';
import { KeychainOptions, KeychainSDK, SignBuffer } from 'keychain-sdk';
import { Socket, io } from 'socket.io-client';
import { KeychainKeyTypes } from 'hive-keychain-commons';
import { HiveUtils } from './utils/hive.utils';
import { PublicKey, Signature, Transaction, cryptoUtils } from '@hiveio/dhive';
import { SignatureRequest } from './interfaces/signature-request';

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
  signTransaction = async (
    data:ISignTransaction
  ): Promise<string[]> => {
    return new Promise(async (resolve, reject) => {
      try {
          const signature = await this.keychain.signTx(
            {
              username: data.username,
              tx: data.decodedTransaction,
              method: data.method
            }
          );
          if(signature.success){
            try{
              const signedTransaction = signature.result;
              const signTransactionMessage: SignTransactionMessage = {
                signature: signedTransaction.signatures[ signedTransaction.signatures.length - 1],
                signerId: data.signerId,
                signatureRequestId: data.signatureRequestId
              }
              this.socket.emit(
                SocketMessageCommand.SIGN_TRANSACTION,
                signTransactionMessage,
                (response: string[]) => {
                  resolve(response);
                },
              );
            }
            catch(error: any) {
              reject(
                new Error('Error occured during signTransaction: ' + error.message),
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


  encode = async(): Promise<void> => {
    return new Promise(async (resolve,reject)=>{
        //initmultisigtransaction
        //before  sendRequestSignatureMessage
    })
  }

  /**
   * @description
   * Decodes the encrypted transaction for the signature request.
   * 
   * @param signatureRequest 
   * @param username 
   * @param publicKey 
   * @returns A Promise that resolves with the decoded transaction as a Transaction object.
   */
  decodeTransaction = async(signatureRequest:SignatureRequest, username:string, publicKey:string): Promise<Transaction> => {
    return new Promise(async (resolve,reject)=>{

      if(!signatureRequest){reject(new Error("You passed an empty signatureRequest in decodeTransaction."));}
      const signer = signatureRequest.signers.find((s)=> s.publicKey === publicKey);
      if(!signer){reject(new Error("The publikKey cannot be found in the list of signers."))}
      try{
        const decodedTx = await this.keychain.decode(
          { username,
            message: signer.encryptedTransaction,
            method: signatureRequest.keyType
          }
        );
        if(decodedTx.success){
          const data = JSON.stringify(decodedTx.result).replace("#","");
          if(typeof data === 'object' && data !== null){

           
            resolve(JSON.parse(data) as Transaction); 
          }
          reject(new Error("Cannot parse transaction string. Invalid transaction format."));
        }
      }catch(error:any){
        reject(new Error("An error occured during decodeTransaction: "+ error.message));
      }
    }
    )
  }

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
  subscribeToSignRequests = (callback: SignatureRequestCallback): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      try{
        this.socket.on(SocketMessageCommand.REQUEST_SIGN_TRANSACTION, (signatureRequest: SignatureRequest) => {
          callback(signatureRequest);
        });
        resolve("Subscribed to signature requests");
      }catch(error:any){
        reject(new Error(
          "Error occured when trying to subscribe to signer requests: " + error.message)
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
  subscribeToBroadcastedTransactions = (callback:SignatureRequestCallback): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      try{
        this.socket.on(SocketMessageCommand.TRANSACTION_BROADCASTED_NOTIFICATION, (signatureRequest: SignatureRequest) => {
          callback(signatureRequest);
        });
        resolve("Subscribed to broadcasted transactions");
      }catch(error:any){
        reject(new Error(
          "Error occured when trying to subscribe to broadcasted transactions: " + error.message
        ));
      }
    });
  };
  
}
