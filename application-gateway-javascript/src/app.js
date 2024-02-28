/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  credentials as _credentials,
  Client,
} from "./node_modules/@grpc/grpc-js";
import {
  connect,
  Contract,
  Identity,
  Signer,
  signers,
} from "@hyperledger/fabric-gateway";
import { createPrivateKey } from "./node_modules/crypto";
import { promises as fs } from "./node_modules/fs";
import { resolve } from "./node_modules/path";
import { TextDecoder } from "./node_modules/util";
//import elliptic from "elliptic";
//import { ES256KSigner, hexToBytes } from "did-jwt";
import { ES256KSigner, hexToBytes } from "./node_modules/did-jwt";

const createDIDButton = document.getElementById("createDIDButton");
const createCredintialButton = document.getElementById(
  "createCredintialButton"
);
const viewDIDButton = document.getElementById("viewDIDButton");

createDIDButton.onclick = createDID;
viewDIDButton.onclick = getDIDByID;
createCredintialButton.onclick = issueVC;

const channelName = envOrDefault("CHANNEL_NAME", "mychannel");
const chaincodeName = envOrDefault("CHAINCODE_NAME", "basic");
const mspId = envOrDefault("MSP_ID", "Org1MSP");

// Path to crypto materials.
const cryptoPath = envOrDefault(
  "CRYPTO_PATH",
  resolve(
    __dirname,
    "..",
    "..",
    "..",
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
//const rollnow = document.

async function main() {
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
    // Get a network instance representing the channel where the smart contract is deployed.
    const network = gateway.getNetwork(channelName);

    // Get the smart contract from the network.
    const contract = network.getContract(chaincodeName);

    // Initialize a set of asset data on the ledger using the chaincode 'InitLedger' function.
    await initLedger(contract);
  } finally {
    gateway.close();
    client.close();
  }
}

main().catch((error) => {
  console.error("******** FAILED to run the application:", error);
  process.exitCode = 1;
});

async function newGrpcConnection() {
  const tlsRootCert = await fs.readFile(tlsCertPath);
  const tlsCredentials = _credentials.createSsl(tlsRootCert);
  return new Client(peerEndpoint, tlsCredentials, {
    "grpc.ssl_target_name_override": peerHostAlias,
  });
}

async function newIdentity() {
  const credentials = await fs.readFile(certPath);
  return { mspId, credentials };
}

async function newSigner() {
  const files = await fs.readdir(keyDirectoryPath);
  const keyPath = resolve(keyDirectoryPath, files[0]);
  const privateKeyPem = await fs.readFile(keyPath);
  const privateKey = createPrivateKey(privateKeyPem);
  return signers.newPrivateKeySigner(privateKey);
}

async function createDID() {
  const rollno = document.getElementById("rollnumber");
  try {
    const result = await contract.submit("createDID", {
      arguments: [rollno],
    });
    displayResult(result);
  } catch (error) {
    console.error(error);
    displayResult("Error: Could not create DID.");
  }
}

async function getDIDByID() {
  const rollno = document.getElementById("rollnumber");
  try {
    const result = await contract.evaluate("getDID", {
      arguments: [rollno],
    });
    displayResult(result);
  } catch (error) {
    console.error(error);
    displayResult("Error: Could not retrieve details.");
  }
  // console.log(
  //   "\n--> Evaluate Transaction: ReadAsset, function returns asset attributes"
  // );

  // const resultBytes = await contract.evaluateTransaction("getDID", rollno);

  // const resultJson = utf8Decoder.decode(resultBytes);
  // const result = JSON.parse(resultJson);
  // console.log("*** Result:", result);
}

async function issueVC() {
  const recipientDID = document.getElementById("recipientDID");
  const name = document.getElementById("name");
  const department = document.getElementById("department");
  const yog = document.getElementById("you");

  const vcPayload = {
    sub: recipientDID,
    nbf: 1562950282,
    vc: {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      type: ["VerifiableCredential"],
      credentialSubject: {
        degree: {
          type: "BachelorDegree",
          name: name,
          department: department,
          YearOfGraduation: yog,
        },
      },
    },
  };

  const key = document.getElementById("privateKey");
  const signer = ES256KSigner(hexToBytes(key));

  const issuer = {
    did: "did:web:skounis.github.io",
    signer: signer,
  };

  try {
    const result = await contract.submit("createVC", {
      arguments: [vcPayload, issuer],
    });
    displayResult(result);
  } catch (error) {
    console.error(error);
    displayResult("Error: Could not retrieve details.");
  }
}

async function verifyCredential() {
  const vcJwt = document.getElementById("vcJwt");
  try {
    const result = await contract.submit("verifyVC", {
      arguments: [vcJwt],
    });
    displayResult(result);
  } catch (error) {
    console.error(error);
    displayResult("Error: Could not retrieve details.");
  }
}

function envOrDefault(name, defaultValue) {
  return process.env[name] || defaultValue;
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
