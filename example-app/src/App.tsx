import React, { useEffect, useState } from 'react';
import './App.css';
import { HiveMultisigSDK } from './hive-multisig-sdk';
import { Button, Card, Form } from 'react-bootstrap';
import { KeychainKeyTypes } from 'hive-keychain-commons';
function App() {
  const [username,setUsername] = useState<string>("krios003") ;
  const [keyChainType, setKeyChainType] = useState<KeychainKeyTypes>(KeychainKeyTypes.posting)
  const [lastPong, setLastPong] = useState(null);
  const multisigSdk = new HiveMultisigSDK(window);


  useEffect(()=>{
    console.log(keyChainType);
  },[keyChainType])

  useEffect(() => {
    console.log(username)
  },[username])

  useEffect(()=>{
    console.log(lastPong);
  },[lastPong])
  
  const connectToSigner = async () => {
    const  connection = await multisigSdk.singleSignerConnect(username,keyChainType);
    console.log(connection);
  }

  const pingServer = async () => {
   multisigSdk.ping(setLastPong);
  }
  return (
    <div className="App">
        <Button variant="primary" onClick={() => {pingServer()}}>Ping Server</Button>{' '}
        <Card style={{ width: '18rem' }}>
          <Form>
            <Form.Group className="mb-3" controlId="userName">
            <Form.Label>Signer Connect</Form.Label>
            <Form.Control type="text" placeholder={username} value = {username} onChange={(e) => setUsername(e.target.value)} />
            <br/>
            <Form.Select aria-label="Keychain Type Select" 
            value={keyChainType}
              onChange={(e) => setKeyChainType(e.currentTarget.value as KeychainKeyTypes)}>
              <option value="Posting">Posting</option>
              <option value="Memo">Memo</option>
              <option value="Active">Active</option>
            </Form.Select>
            <br/>
            <Button variant="primary" onClick={() => {connectToSigner()}}>Connect to Signer</Button>{' '}
          </Form.Group>
          </Form>
        </Card>
    </div>
  );
}

export default App;
