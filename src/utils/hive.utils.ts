import { Authority, Client, PublicKey, SignedTransaction, Transaction } from '@hiveio/dhive';
import { KeychainKeyTypes } from 'hive-keychain-commons';
import { Authorities } from '../interfaces/signer';

let hiveClient: Client;

const getClient = () => {
  if (!hiveClient)
    hiveClient = new Client([
      'https://api.hive.blog',
      'https://api.hivekings.com',
      'https://anyx.io',
      'https://api.openhive.network',
    ]);
  return hiveClient;
};
const getAccount = async (username: string) => {
  var client = getClient();
  return client.database.getAccounts([username]);
};
const getAccountAuthorities = async (username: string) => {

  const account = await getAccount(username);
  if (!account || account.length === 0) {
    return undefined;
  }
  const keys:Authorities = {
    account: account[0].name,
    owner: account[0].owner,
    active: account[0].active,
    posting: account[0].posting,
    memo_key: account[0].memo_key,
    json_metadata: account[0].json_metadata,
  };
  return keys;
};

export const getPublicKeys = async (
  username:string,
  keyType: KeychainKeyTypes,
) => {
  const authorities = await getAccount(username);
  if (authorities) {
    switch (keyType) {
      case KeychainKeyTypes.active:
        return authorities[0].active.key_auths.map((key) => {
          return key[0];
        });
      case KeychainKeyTypes.posting:
        return authorities[0].posting.key_auths.map((key) => {
          return key[0];
        });
        default: return undefined;
    }
  }
  return undefined;
};


const broadcastTx = async(transaction:SignedTransaction) =>{
  var client = getClient();
  var res = await client.broadcast.send(transaction);
  return res;
}

const getPublicKey = async(username:string, keyType: KeychainKeyTypes) =>{
  var account = await getAccount(username);
  try{
    switch(keyType){
      case KeychainKeyTypes.posting:
         return account[0].posting.key_auths[0][0]
      case KeychainKeyTypes.active:
         return account[0].active.key_auths[0][0]
     }
  }catch{
    throw  Error(`Cannot find public key for ${username}`);
  }
}

const getEncodedTxReceivers = async(authority:Authority, method:KeychainKeyTypes) =>{

  let receivers:[string,number][] =[] 
  for(let i=0; i<authority.account_auths.length; i++){
    const pk = await getPublicKeys(authority.account_auths[i][0],method);
    if(pk){
      for(let k = 0 ; k<pk.length; k++){
        receivers.push([pk[k].toString(),authority.account_auths[i][1]]);
      }
    }
  }
  for(let k=0; k<authority.key_auths.length;k++){
    receivers.push([authority.key_auths[k][0].toString(), authority.key_auths[k][1]])
  }

  return receivers
}

export const HiveUtils = {
  getClient,
  getAccount,
  getPublicKey,
  getEncodedTxReceivers,
  broadcastTx,
  getAccountAuthorities
  
};
