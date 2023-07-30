import { Authority, Client, PublicKey, SignedTransaction, Transaction } from '@hiveio/dhive';
import { KeychainKeyTypes } from 'hive-keychain-commons';

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
    const pk = await getPublicKey(authority.account_auths[i][0],method);
    if(pk){
      receivers.push([pk.toString(),authority.account_auths[i][1]]);
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
  broadcastTx
  
};
