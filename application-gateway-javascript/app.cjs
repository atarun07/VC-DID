/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const { credentials: _credentials, Client } = require("@grpc/grpc-js");
const {
  connect,
  Contract,
  Identity,
  Signer,
  signers,
} = require("@hyperledger/fabric-gateway");
const { createPrivateKey } = require("crypto");
const fs = require("fs");
const { resolve, join } = require("path");
const { TextDecoder } = require("util");
// No require equivalent for elliptic as it's not used in the provided code
// No require equivalent for ES256KSigner and hexToBytes as they come from "did-jwt"
const { ES256KSigner, hexToBytes } = require("did-jwt");

// const createDIDButton = document.getElementById("createDIDButton");
// const createCredintialButton = document.getElementById(
//   "createCredintialButton"
// );
// const viewDIDButton = document.getElementById("viewDIDButton");

// createDIDButton.onclick = createDID;
// viewDIDButton.onclick = getDIDByID;
// createCredintialButton.onclick = issueVC;

const channelName = envOrDefault("CHANNEL_NAME", "mychannel");
const chaincodeName = envOrDefault("CHAINCODE_NAME", "did");
const mspId = envOrDefault("MSP_ID", "Org1MSP");

// Path to crypto materials.
const cryptoPath = envOrDefault(
  "CRYPTO_PATH",
  resolve(
    __dirname,
    "..",
    "..",
    "..",
    "fabric-samples",
    "test-network",
    "organizations",
    "peerOrganizations",
    "org1.example.com"
  )
);

// Path to user private key directory.
const keyDirectoryPath = envOrDefault(
  "KEY_DIRECTORY_PATH",
  resolve(cryptoPath, "users", "User1@org1.example.com", "msp", "keystore")
);

// Path to user certificate.
const certPath = envOrDefault(
  "CERT_PATH",
  resolve(
    cryptoPath,
    "users",
    "User1@org1.example.com",
    "msp",
    "signcerts",
    "cert.pem"
  )
);

// Path to peer tls certificate.
const tlsCertPath = envOrDefault(
  "TLS_CERT_PATH",
  resolve(cryptoPath, "peers", "peer0.org1.example.com", "tls", "ca.crt")
);

// Gateway peer endpoint.
const peerEndpoint = envOrDefault("PEER_ENDPOINT", "localhost:7051");

// Gateway peer SSL host name override.
const peerHostAlias = envOrDefault("PEER_HOST_ALIAS", "peer0.org1.example.com");

const utf8Decoder = new TextDecoder();
const assetId = `asset${Date.now()}`;

async function main() {
  console.log("Hello, world!");
  await displayInputParameters();

  // The gRPC client connection should be shared by all Gateway connections to this endpoint.
  const client = await newGrpcConnection();

  const gateway = connect({
    client,
    identity: await newIdentity(),
    signer: await newSigner(),
    // Default timeouts for different gRPC calls
    evaluateOptions: () => {
      return { deadline: Date.now() + 5000 }; // 5 seconds
    },
    endorseOptions: () => {
      return { deadline: Date.now() + 15000 }; // 15 seconds
    },
    submitOptions: () => {
      return { deadline: Date.now() + 5000 }; // 5 seconds
    },
    commitStatusOptions: () => {
      return { deadline: Date.now() + 60000 }; // 1 minute
    },
  });

  try {
    const network = gateway.getNetwork(channelName);
    const contract = network.getContract(chaincodeName);

    await createDID(contract);

    await getDIDByID(contract);

    // const putResult = await contract.submitTransaction(
    //   "put",
    //   "time",
    //   new Date().toISOString()
    // );
    // console.log("Put result:", utf8Decoder.decode(putResult));

    // const getResult = await contract.evaluateTransaction("get", "time");
    // console.log("Get result:", utf8Decoder.decode(getResult));
  } finally {
    gateway.close();
    client.close();
  }
}

function envOrDefault(name, defaultValue) {
  return process.env[name] || defaultValue;
}

async function newGrpcConnection() {
  const tlsRootCert = fs.readFileSync(tlsCertPath, (err, data) => {
    if (err) {
      console.log(err);
    } else {
      console.log(data);
    }
  });
  const tlsCredentials = _credentials.createSsl(tlsRootCert);
  return new Client(peerEndpoint, tlsCredentials, {
    "grpc.ssl_target_name_override": peerHostAlias,
  });
}

async function newIdentity() {
  const credentials = fs.readFileSync(certPath, (err, data) => {
    if (err) {
      console.log(err);
    } else {
      console.log(data);
    }
  });
  return { mspId, credentials };
}

async function newSigner() {
  const content = fs.readdirSync(keyDirectoryPath, (err, files) => {
    if (err) throw err;
    console.log(files);
  });
  console.log(content);
  const keyPath = resolve(keyDirectoryPath, content[0]);
  const privateKeyPem = fs.readFileSync(keyPath, (err, data) => {
    if (err) {
      console.log(err);
    } else {
      console.log(data);
    }
  });
  const privateKey = createPrivateKey(privateKeyPem);
  return signers.newPrivateKeySigner(privateKey);
}

async function displayInputParameters() {
  console.log("Input Parameters:");
  console.log(`Channel Name: ${channelName}`);
  console.log(`Chaincode Name: ${chaincodeName}`);
  console.log(`MSP ID: ${mspId}`);
  console.log(`Crypto Path: ${cryptoPath}`);
  console.log(`Key Directory Path: ${keyDirectoryPath}`);
  console.log(`Cert Path: ${certPath}`);
  console.log(`tlsCertPath:       ${tlsCertPath}`);
  console.log(`peerEndpoint:      ${peerEndpoint}`);
  console.log(`peerHostAlias:     ${peerHostAlias}`);
}

async function createDID(contract) {
  //const rollno = document.getElementById("rollnumber");
  const rollno = "1";
  try {
    const result = await contract.submit("createDID", {
      arguments: [rollno],
    });
    console.log("*** Transaction committed successfully");
    console.log(result);
  } catch (error) {
    console.error(error);
    console.log("Error: Could not create DID.");
  }
}

async function getDIDByID(contract) {
  //const rollno = document.getElementById("rollnumber");
  const rollno = "1";
  try {
    const resultBytes = await contract.evaluate("getDID", {
      arguments: [rollno],
    });
    const resultJson = utf8Decoder.decode(resultBytes);
    const result = JSON.parse(resultJson);
    console.log("*** Result:", result);
    console.log(result);
  } catch (error) {
    console.error(error);
    console.log("Error: Could not retrieve details.");
  }
  // console.log(
  //   "\n--> Evaluate Transaction: ReadAsset, function returns asset attributes"
  // );

  // const resultBytes = await contract.evaluateTransaction("getDID", rollno);

  // const resultJson = utf8Decoder.decode(resultBytes);
  // const result = JSON.parse(resultJson);
  // console.log("*** Result:", result);
}

main().catch((error) => {
  console.error("******** FAILED to run the application:", error);
  process.exitCode = 1;
});
