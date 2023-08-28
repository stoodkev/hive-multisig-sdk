import {
  AccountCreateOperation,
  AccountCreateWithDelegationOperation,
  AccountUpdate2Operation,
  AccountUpdateOperation,
  AccountWitnessProxyOperation,
  AccountWitnessVoteOperation,
  Authority,
  CancelTransferFromSavingsOperation,
  ChangeRecoveryAccountOperation,
  ClaimAccountOperation,
  ClaimRewardBalanceOperation,
  CollateralizedConvertOperation,
  CommentOperation,
  CommentOptionsOperation,
  ConvertOperation,
  CreateClaimedAccountOperation,
  CreateProposalOperation,
  CustomBinaryOperation,
  CustomJsonOperation,
  CustomOperation,
  DeclineVotingRightsOperation,
  DelegateVestingSharesOperation,
  DeleteCommentOperation,
  EscrowApproveOperation,
  EscrowDisputeOperation,
  EscrowReleaseOperation,
  EscrowTransferOperation,
  FeedPublishOperation,
  LimitOrderCancelOperation,
  LimitOrderCreate2Operation,
  LimitOrderCreateOperation,
  PowOperation,
  RecoverAccountOperation,
  RecurrentTransferOperation,
  RemoveProposalOperation,
  ReportOverProductionOperation,
  RequestAccountRecoveryOperation,
  ResetAccountOperation,
  SetResetAccountOperation,
  SetWithdrawVestingRouteOperation,
  SignedTransaction,
  Transaction,
  TransferFromSavingsOperation,
  TransferOperation,
  TransferToSavingsOperation,
  TransferToVestingOperation,
  UpdateProposalOperation,
  UpdateProposalVotesOperation,
  VoteOperation,
  WithdrawVestingOperation,
  WitnessSetPropertiesOperation,
  WitnessUpdateOperation,
} from '@hiveio/dhive';
import axios from 'axios';
import { KeychainKeyTypes } from 'hive-keychain-commons';
import { KeychainSDK, SignBuffer } from 'keychain-sdk';
import * as io from 'socket.io-client';
import { SignatureRequest } from './interfaces/signature-request';
import {
  IDecodeTransaction,
  IEncodeTransaction,
  ISignTransaction,
  ISignatureRequest,
  ITransaction,
  MultisigOptions,
  NotifyTxBroadcastedMessage,
  RequestSignatureMessage,
  RequestSignatureSigner,
  SignTransactionMessage,
  SignatureRequestCallback,
  SignerConnect,
  SignerConnectMessage,
  SignerConnectResponse,
  SocketMessageCommand,
} from './interfaces/socket-message-interface';
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
  private static instance: HiveMultisigSDK;
  window: Window;
  options?: MultisigOptions;
  keychain: KeychainSDK;
  socket: io.Socket;
  constructor(window: Window, options?: MultisigOptions) {
    this.window = window;
    this.keychain = new KeychainSDK(this.window);
    if (!options) {
      this.options = {
        apiAddress:'http://localhost:5000',
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
  public static getInstance(
    window: Window,
    options?: MultisigOptions,
  ): HiveMultisigSDK {
    if (!HiveMultisigSDK.instance) {
      HiveMultisigSDK.instance = new HiveMultisigSDK(window, options);
    }
    return HiveMultisigSDK.instance;
  }

  getTransactions = async (
    signer: SignerConnect,
    )=>{
      const signBuffer = await this.keychain.signBuffer({
        username: signer.username,
        message: signer.username,
        method: signer.keyType,
      } as SignBuffer);
      if(signBuffer.success){
        const url = `${this.options?.apiAddress}/signature-request/all`;
        const headers = {
          'publicKey': signBuffer.publicKey
            ? signBuffer.publicKey.toString()
            : '',
          'message': JSON.stringify(signBuffer.result).replace(/"/g, ''),
        };
      axios.get(url, {
        params:{publicKey: signBuffer.publicKey},
        headers: headers,
        withCredentials: false,
      })
        .then((response) => {
          // Handle the response here
          console.log('Response:', response.data);
        })
        .catch((error) => {
          // Handle any errors here
          console.error('Error:', error);
        });
      }
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
            publicKey: signBuffer.publicKey
              ? signBuffer.publicKey.toString()
              : '',
            message: JSON.stringify(signBuffer.result).replace(/"/g, ''),
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
        } else {
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
  ): Promise<boolean> => {
    return new Promise(async (resolve, reject) => {
      //TODO: uncomment and test broadcast
      //const broadcastResult = await HiveUtils.broadcastTx(transaction.transaction);

      try {
        var message: NotifyTxBroadcastedMessage = {
          signatureRequestId: transaction.signatureRequestId,
        };
        this.socket.emit(
          SocketMessageCommand.NOTIFY_TRANSACTION_BROADCASTED,
          message,
          () => {
            //TODO: uncomment and test broadcast
            // resolve(broadcastResult);
            console.log('Broadcasted');
            resolve(true);
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
        const broadcaster = HiveMultisigSDK.getUsernameFromTransaction(data.transaction);
        if(broadcaster){
          const threshold = await HiveUtils.getThreshold(broadcaster.toString(),data.method);
          let potentialSigners: [string, number][] =
            await HiveUtils.getPotentialSigners(broadcaster.toString(), data.method);
          let signerList: RequestSignatureSigner[] = [];
          
          if (potentialSigners.length > 0) {
            const encodedTransaction = await this.keychain.encodeWithKeys({
              username: broadcaster.toString(),
              publicKeys: potentialSigners.map((k) => {
                return k[0];
              }),
              message: `#${JSON.stringify(signedTransaction)}`,
              method: data.method,
            });

            if (encodedTransaction.success && encodedTransaction.result) {
              const resultString = JSON.stringify(encodedTransaction.result);
              const encodedTx = JSON.parse(resultString);
              for (let i = 0; i < potentialSigners.length; i++) {
                var result = encodedTx[potentialSigners[i][0]];
                var signer: RequestSignatureSigner = {
                  encryptedTransaction: result,
                  publicKey: potentialSigners[i][0],
                  weight: potentialSigners[i][1].toString(),
                };
                signerList.push(signer);
              }
              const signatureRequest: ISignatureRequest = {
                expirationDate: data.expirationDate,
                threshold: threshold as number,
                keyType: data.method,
                signers: signerList,
              };

              const requestSignMsg: RequestSignatureMessage = {
                signatureRequest,
                initialSigner: {
                  username: data.initiator.username.toString(),
                  publicKey: data.initiator.publicKey,
                  signature: signedTransaction.signatures[0],
                  weight: data.initiator.weight as number,
                },
              };

              resolve(requestSignMsg);
            } else {
              reject(new Error('Failed to encode transaction'));
              return;
            }
        }
        }
        if(!broadcaster){
          reject(`Failed to get broadcaster from transaction`);
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
  ): Promise<ITransaction[]|undefined> => {
    return new Promise(async (resolve, reject) => {
      if (data.signatureRequest.length <= 0) {
        reject(
          new Error(
            'You passed an empty signatureRequest in decodeTransaction.',
          ),
        );
      }
      try {
        let transactions: ITransaction[] = [];
        for (var k = 0; k < data.signatureRequest.length; k++) {
          const signRequest = data.signatureRequest[k];
          const signerPublicKeys = await getPublicKeys(
            data.username,
            signRequest.keyType,
          );
          if (!signerPublicKeys) {
            reject(new Error(`No publicKey can be found for ${data.username}`));
          }
            for (var i = 0; i < signRequest.signers.length; i++) {
              const signer = signRequest.signers[i];
              if (signerPublicKeys?.includes(signer.publicKey)) {
                try {
                  const decodedMsg = await this.keychain.decode({
                    username: data.username,
                    message: signer.encryptedTransaction,
                    method: signRequest.keyType,
                  });
                  if (decodedMsg.success) {
                    const jsonString = `${decodedMsg.result}`;
                    const decodedTx: SignedTransaction = JSON.parse(
                      jsonString.replace('#', ''),
                    );
                    const validAuth =
                      await HiveMultisigSDK.validateInitiatorOverBroadcaster(
                        signRequest.initiator,
                        signRequest.keyType,
                        decodedTx,
                      );
                    if (validAuth) {
                      const tx: ITransaction = {
                        signer: signer,
                        signatureRequestId: signRequest.id,
                        transaction: decodedTx,
                        method: signRequest.keyType,
                        username: data.username,
                      };
                      transactions.push(tx);
                    }else{
                      reject("Invalid initiator.")
                    }
                  }else{
                    reject('Decoding failed.');
                  }
                } catch (error: any) {
                  reject(
                    new Error(
                      'An error occured during decodeTransaction: ' +
                        error.message,
                    ),
                  );
                }
              }
            }
        }
        if(transactions.length===0){
          reject("No decoded transactions");
        }else{
          resolve(transactions);
        }
      } catch (error: any) {
        reject(new Error(`Error while decoding transactions: ${error}`));
      }
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


  static validateInitiatorOverBroadcaster = async (initiator:string,keyType: KeychainKeyTypes,
    transaction: SignedTransaction,)=>{
      const txUsername = HiveMultisigSDK.getUsernameFromTransaction(transaction);
      if (!txUsername) {
        return undefined;
      }
      const initiatorPublicKeys = await HiveUtils.getPublicKeys(initiator,keyType);
      const userAuthorities = await HiveUtils.getPotentialSigners(
        txUsername.toString(),
        keyType,
      );
      if(!initiatorPublicKeys){
        return undefined;
      }
      if (!userAuthorities) {
        return undefined;
      }

      //check if any of the initiator public keys will match a public key in user authorities
      for(const key of initiatorPublicKeys){
        for (const [u, w] of userAuthorities) {
          if (key === u && w > 0) {
            return true;
          }
        }
      }
     
      return false;
  }
  /**
   * @description
   * Returns the list of authorities in a form of [string,number] tuple of username/key and weight with respect to key type.
   *
   * @param username the username owner account
   * @param keyType the keytype of authorities
   * @returns
   */
  static getAuthorities = async (
    username: string,
    keyType: KeychainKeyTypes,
  ) => {
    const authorities = await HiveUtils.getAccount(username);
    let auths: [string, number][] = [];
    if (authorities) {
      switch (keyType) {
        case KeychainKeyTypes.active:
          for (const [acc, weight] of authorities[0].active.account_auths) {
            auths.push([acc, weight]);
          }
          for (const [key, weight] of authorities[0].active.key_auths) {
            auths.push([key.toString(), weight]);
          }
          return auths;
        case KeychainKeyTypes.posting:
          for (const [acc, weight] of authorities[0].posting.account_auths) {
            auths.push([acc, weight]);
          }
          for (const [key, weight] of authorities[0].posting.key_auths) {
            auths.push([key.toString(), weight]);
          }
          return auths;
        default:
          return undefined;
      }
    }
    return undefined;
  };

  /**
   * @description
   * Get the username that will request the broadcast of a given tx
   *
   * @param tx A Hive transaction
   * @returnsA username if a single one is found, undefined if the tx is badly formatted or if two different signers are needed.
   * Abort operations in these cases.
   */
  static getUsernameFromTransaction = (tx: Transaction) => {
    let username;
    if (!tx.operations || !tx.operations.length) return;
    for (const op of tx.operations) {
      if (!op[0] || !op[1] || typeof op[1] !== 'object') return;
      let newUsername;
      switch (op[0]) {
        case 'account_create':
          newUsername = (op as AccountCreateOperation)[1].creator;
          break;
        case 'account_create_with_delegation':
          newUsername = (op as AccountCreateWithDelegationOperation)[1].creator;
          break;
        case 'account_update':
          newUsername = (op as AccountUpdateOperation)[1].account;
          break;
        case 'account_update2':
          newUsername = (op as AccountUpdate2Operation)[1].account;
          break;
        case 'account_witness_proxy':
          newUsername = (op as AccountWitnessProxyOperation)[1].account;
          break;
        case 'account_witness_vote':
          newUsername = (op as AccountWitnessVoteOperation)[1].account;
          break;
        case 'cancel_transfer_from_savings':
          newUsername = (op as CancelTransferFromSavingsOperation)[1].from;
          break;
        case 'change_recovery_account':
          newUsername = (op as ChangeRecoveryAccountOperation)[1]
            .account_to_recover;
          break;
        case 'claim_account':
          newUsername = (op as ClaimAccountOperation)[1].creator;
          break;
        case 'claim_reward_balance':
          newUsername = (op as ClaimRewardBalanceOperation)[1].account;
          break;
        case 'collateralized_convert':
          newUsername = (op as CollateralizedConvertOperation)[1].owner;
          break;
        case 'comment':
          newUsername = (op as CommentOperation)[1].author;
          break;
        case 'comment_options':
          newUsername = (op as CommentOptionsOperation)[1].author;
          break;
        case 'convert':
          newUsername = (op as ConvertOperation)[1].owner;
          break;
        case 'create_claimed_account':
          newUsername = (op as CreateClaimedAccountOperation)[1].creator;
          break;
        case 'create_proposal':
          newUsername = (op as CreateProposalOperation)[1].creator;
          break;
        case 'custom':
          newUsername = (op as CustomOperation)[1].required_auths?.[0];
          break;
        case 'custom_binary':
          newUsername =
            (op as CustomBinaryOperation)[1].required_auths?.[0] ||
            (op as CustomBinaryOperation)[1].required_posting_auths?.[0] ||
            (op as CustomBinaryOperation)[1].required_active_auths?.[0] ||
            (op as CustomBinaryOperation)[1].required_owner_auths?.[0];
          break;
        case 'custom_json':
          newUsername =
            (op as CustomJsonOperation)[1].required_auths?.[0] ||
            (op as CustomJsonOperation)[1].required_posting_auths?.[0];
          break;
        case 'decline_voting_rights':
          newUsername = (op as DeclineVotingRightsOperation)[1].account;
          break;
        case 'delegate_vesting_shares':
          newUsername = (op as DelegateVestingSharesOperation)[1].delegator;
          break;
        case 'delete_comment':
          newUsername = (op as DeleteCommentOperation)[1].author;
          break;
        case 'escrow_approve':
          newUsername = (op as EscrowApproveOperation)[1].who;
          break;
        case 'escrow_dispute':
          newUsername = (op as EscrowDisputeOperation)[1].who;
          break;
        case 'escrow_release':
          newUsername = (op as EscrowReleaseOperation)[1].who;
          break;
        case 'escrow_transfer':
          newUsername = (op as EscrowTransferOperation)[1].from;
          break;
        case 'feed_publish':
          newUsername = (op as FeedPublishOperation)[1].publisher;
          break;
        case 'limit_order_cancel':
          newUsername = (op as LimitOrderCancelOperation)[1].owner;
          break;
        case 'limit_order_create':
          newUsername = (op as LimitOrderCreateOperation)[1].owner;
          break;
        case 'limit_order_create2':
          newUsername = (op as LimitOrderCreate2Operation)[1].owner;
          break;
        case 'pow':
          newUsername = (op as PowOperation)[1].worker_account;
          break;
        case 'recover_account':
          newUsername = (op as RecoverAccountOperation)[1].account_to_recover;
          break;
        case 'report_over_production':
          newUsername = (op as ReportOverProductionOperation)[1].reporter;
          break;
        case 'request_account_recovery':
          newUsername = (op as RequestAccountRecoveryOperation)[1]
            .account_to_recover;
          break;
        case 'reset_account':
          newUsername = (op as ResetAccountOperation)[1].account_to_reset;
          break;
        case 'set_reset_account':
          newUsername = (op as SetResetAccountOperation)[1].account;
          break;
        case 'set_withdraw_vesting_route':
          newUsername = (op as SetWithdrawVestingRouteOperation)[1]
            .from_account;
          break;
        case 'transfer':
          newUsername = (op as TransferOperation)[1].from;
          break;
        case 'transfer_from_savings':
          newUsername = (op as TransferFromSavingsOperation)[1].from;
          break;
        case 'transfer_to_savings':
          newUsername = (op as TransferToSavingsOperation)[1].from;
          break;
        case 'transfer_to_vesting':
          newUsername = (op as TransferToVestingOperation)[1].from;
          break;
        case 'vote':
          newUsername = (op as VoteOperation)[1].voter;
          break;
        case 'withdraw_vesting':
          newUsername = (op as WithdrawVestingOperation)[1].account;
          break;
        case 'witness_set_properties':
          newUsername = (op as WitnessSetPropertiesOperation)[1].owner;
          break;
        case 'witness_update':
          newUsername = (op as WitnessUpdateOperation)[1].owner;
          break;
        case 'update_proposal':
          newUsername = (op as UpdateProposalOperation)[1].creator;
          break;
        case 'remove_proposal':
          newUsername = (op as RemoveProposalOperation)[1].proposal_owner;
          break;
        case 'update_proposal_votes':
          newUsername = (op as UpdateProposalVotesOperation)[1].voter;
          break;
        case 'recurrent_transfer':
          newUsername = (op as RecurrentTransferOperation)[1].from;
          break;
      }
      if (username && username !== newUsername) return;
      else username = newUsername;
    }
    return username;
  };
}
