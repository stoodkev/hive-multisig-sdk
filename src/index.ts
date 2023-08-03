import {
  Authority,
  PublicKey,
  Signature,
  SignedTransaction,
  Transaction,
  cryptoUtils,
} from '@hiveio/dhive';
import { KeychainKeyTypes } from 'hive-keychain-commons';
import * as io from 'socket.io-client';
import { SignatureRequest } from './interfaces/signature-request';
import {
  IDecodeTransaction,
  IEncodeTransaction,
  ISignTransaction,
  ISignatureRequest,
  ITransaction,
  MultisigOptions,
  RequestSignatureMessage,
  RequestSignatureSigner,
  SignTransactionMessage,
  SignatureRequestCallback,
  SignerConnect,
  SignerConnectMessage,
  SignerConnectResponse,
  SocketMessageCommand,
} from './interfaces/socket-message-interface';
import {
  Broadcast,
  Encode,
  EncodeWithKeys,
  KeychainRequestResponse,
  KeychainSDK,
  SignBuffer,
} from 'keychain-sdk';
import { HiveUtils, getPublicKeys } from './utils/hive.utils';

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
  socket: io.Socket;
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
    this.socket = io.connect(this.options.socketAddress);
    this.socket.on('connect', () => {
      console.log(`Socket Connected with ID: ${this.socket.id}`);
    });
  }

  /**
   * @description
   * This function is called to connect to an account before making a multi-signature transaction.
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
   * @returns signerConnect
   */
  signerConnect = async (
    signer: SignerConnect,
  ): Promise<SignerConnectResponse> => {
    return new Promise(async (resolve, reject) => {
      try {
        const signBuffer = await this.keychain.signBuffer({
          username: signer.username,
          message: signer.username,
          method: signer.keyType,
        } as SignBuffer);
        if (signBuffer.success) {
          const signerConnectParams: SignerConnectMessage = {
            publicKey: signBuffer.publicKey?signBuffer.publicKey:'',
            message: JSON.stringify(signBuffer.result).replace(`"`, ''),
            username: signer.username,
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
      } catch (error: any) {
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
        }else{
          reject(signature.error);
        }
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
   * @param message The ITransaction containing the transaction with the appended signature of broadcasting user.
   * @returns A Promise that resolves with a string message indicating successful notification.
   */
  broadcastTransaction = async (
    transaction: ITransaction,
  ): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      //TODO: uncomment and test broadcast
      // const broadcastResult = HiveUtils.broadcastTx(transaction.transaction);
      
      try {
        this.socket.emit(
          SocketMessageCommand.NOTIFY_TRANSACTION_BROADCASTED,
          transaction.signatureRequestId
          ,
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
  encodeTransaction = (
    data: IEncodeTransaction,
  ): Promise<RequestSignatureMessage> => {
    return new Promise<RequestSignatureMessage>(async (resolve, reject) => {
      try {
        const signature = await this.keychain.signTx({
          username: data.initiator.username.toString(),
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
        let receivers: [string, number][] =
          await HiveUtils.getEncodedTxReceivers(data.authority, data.method);
        let signerList: RequestSignatureSigner[] = [];

        if (receivers.length > 0) {
          const encodedTransaction = await this.keychain.encodeWithKeys({
            username: data.initiator.username.toString(),
            publicKeys: receivers.map((k) => {
              return k[0];
            }),
            message: `#${JSON.stringify(signedTransaction)}`,
            method: data.method,
          });

          if (encodedTransaction.success && encodedTransaction.result) {

            const resultString = JSON.stringify(encodedTransaction.result);
            const encodedTx = JSON.parse(resultString) ;
            for(let i=0; i<receivers.length; i++){
              var result = encodedTx[receivers[i][0]];
              var signer:RequestSignatureSigner = {
                encryptedTransaction:result,
                publicKey:receivers[i][0],
                weight:receivers[i][1].toString()
               }
              signerList.push(signer);
              
            }

            const signatureRequest: ISignatureRequest={
              expirationDate: data.expirationDate,
              threshold: data.authority.weight_threshold,
              keyType: data.method,
              signers: signerList
            }

            const requestSignMsg: RequestSignatureMessage = {
              signatureRequest,
              initialSigner:{
                username: data.initiator.username,
                publicKey: data.initiator.publicKey,
                signature: signedTransaction.signatures[0],
                weight: data.initiator.weight as number
              }
            }

            resolve(requestSignMsg);
          } else {
            reject(new Error('Failed to encode transaction'));
            return;
          }
        }
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
   * @returns A Promise that resolves with the decoded transaction as a Transaction object.
   */
  decodeTransaction = async (
    data: IDecodeTransaction,
  ): Promise<ITransaction[]> => {
    return new Promise(async (resolve, reject) => {
      if (data.signatureRequest.length<=0) {
        reject(
          new Error(
            'You passed an empty signatureRequest in decodeTransaction.',
          ),
        );
      }
      try{
        let transactions: ITransaction[] = [];
        for(var k = 0; k<data.signatureRequest.length; k++){
          const signRequest = data.signatureRequest[k];
          const publicKeys = await getPublicKeys(data.username,signRequest.keyType);
          if(!publicKeys){reject(new Error(`No publicKey can be found for ${data.username}}`))}
          if(signRequest.initiator !== data.username){ //dont decode for initiator
            for(var i = 0; i < signRequest.signers.length; i++){ //loop through signers
              const signer = signRequest.signers[i];
              if(publicKeys?.includes(signer.publicKey)){ // check if the signer is one of my publickey
                try{
                  const decodedMsg = await this.keychain.decode({
                    username: data.username,
                    message: signer.encryptedTransaction,
                    method: signRequest.keyType
                  })
                  if(decodedMsg.success){
                    const jsonString =  `${decodedMsg.result}`;
                    const decodedTx:SignedTransaction = JSON.parse(
                      jsonString.replace('#', ''),
                    );
                    const tx: ITransaction = {
                      signerId: signer.id,
                      signatureRequestId: signRequest.id,
                      transaction: decodedTx,
                      method: signRequest.keyType,
                      username: data.username,
                    };
                    transactions.push(tx);
                  }
                }catch (error:any){
                  reject(
                    new Error(
                      'An error occured during decodeTransaction: ' + error.message,
                    ),
                  );
                }
              }
            }
          }
        }
        resolve(transactions);
      }catch(error:any){
        reject(
          new Error(
            `Error while decoding transactions: ${error}`
          ))
      }
      
  })
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
