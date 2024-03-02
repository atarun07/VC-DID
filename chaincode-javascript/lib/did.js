/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

"use strict";

const stringify = require("json-stringify-deterministic");
const sortKeysRecursive = require("sort-keys-recursive");
const { Contract } = require("fabric-contract-api");
const crypto = require("crypto");
const elliptic = require("elliptic");
const { getResolver } = require("web-did-resolver");
const { ES256KSigner, hexToBytes } = require("did-jwt");
const { verifyCredential } = require("did-jwt-vc");
const { Resolver } = require("did-resolver");
const { createVerifiableCredentialJwt } = require("did-jwt-vc");

class DIDContract extends Contract {
  async createDID(ctx, rollno) {
    // Check if the key already exists
    const existingDID = await ctx.stub.getState(rollno);
    if (!existingDID) {
      throw new Error(`Failed to retrieve DID for key ${rollno}`);
    }
    if (existingDID.length > 0) {
      throw new Error(`DID with key ${rollno} already exists`);
    }
    // Request a 32 byte key
    const size = parseInt(process.argv.slice(2)[0]) || 32;
    const randomString = crypto.randomBytes(size).toString("hex");
    const key = randomString;

    //console.log(`Key (hex): ${key}`); // ee48d32e6c724c4d

    // Calculate the `secp256k1` curve and build the public key
    const ec = new elliptic.ec("secp256k1");
    const prv = ec.keyFromPrivate(key, "hex");
    const pub = prv.getPublic();
    const pubx = pub.x.toBuffer().toString("hex");
    // Store the DID in JSON format
    await ctx.stub.putState(rollno, Buffer.from(pubx));
    return `Your Public key is ${pubx}, Your Private is ${prv.priv
      .toBuffer()
      .toString("hex")}`;
  }

  async getDID(ctx, rollno) {
    // Retrieve the DID associated with the key
    const didBytes = await ctx.stub.getState(rollno);
    if (!didBytes || didBytes.length === 0) {
      throw new Error(`No DID found for key ${rollno}`);
    }

    // Parse and return the DID in JSON format
    const didJSON = didBytes.toString("utf8");
    return didJSON;
  }

  async createVC(ctx, payload, issuer) {
    const vcJwt = await createVerifiableCredentialJwt(payload, issuer);
    return vcJwt;
  }

  async verifyVC(ctx, vcJwt) {
    // Prepare the did:web resolver
    const resolver = new Resolver(getResolver());

    // Verify the Credentantial and the Presentation
    const verifiedVC = await verifyCredential(vcJwt, resolver);
    return verifiedVC;
  }
}

module.exports = DIDContract;
