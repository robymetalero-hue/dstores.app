# Security Specification & Threat Model

This document outlines the security specifications, data invariants, and adversarial threat models for the Product Management catalog.

## 1. Data Invariants

1. **Existence Invariant**: A product cannot exist without a valid name, category, structured price, and stock info.
2. **Identity Invariant**: A product's `createdBy` field must exactly match the authenticated user's Firebase Authentication UID.
3. **Immutability Invariant**: The `createdBy` and `createdAt` fields must never be changed after the product is created.
4. **Temporal Invariant**: The `createdAt` and `updatedAt` timestamps must map to the server's request block time.
5. **Boundary Invariant**: Negative prices or stocks are strictly prohibited. Product names and categories have maximum length caps.

---

## 2. The "Dirty Dozen" Malicious Payloads (Vulnerability Scenarios)

The rules are compiled to block any of the following 12 malicious requests with `PERMISSION_DENIED`:

### Identity Spoofing Attacks
1. **Unauthenticated Creation**: Creating a product without signing in.
2. **UID Spoofing**: Creating a product with `createdBy` set to someone else's UID (`victim_uid`).
3. **Creator Email Spoofing**: Setting `creatorEmail` to another user's email address to impersonate authority.

### Integrity & Schema Breaches
4. **Missing Required Fields**: Submitting a product payload without a required field (e.g., missing `price`).
5. **Negative Pricing**: Registering a product with `price = -250` to break purchase calculations.
6. **Negative Inventory**: Deserializing a product with negative stock `stock = -5`.
7. **Giant Payload Attacks**: Submitting a 5MB product name to crash index render paths.
8. **Malicious Image URLs**: Submitting an excessively long or invalid protocol for `imageUrl`.

### State & Lifecycle Violations
9. **Tampering with Creation Timestamps**: Attempting to backdate or fake the `createdAt` timestamp.
10. **Hijacking Existing Creations (Update Attack)**: User B trying to overwrite a product originally published by User A.
11. **Illegal Key Insertion**: Attempting to inject a ghost field `isAdmin: true` into the product document schema.
12. **Foreign Delete (Adversarial Destruction)**: User B triggering a deletion request on a product owned by User A.

---

## 3. The Firebase Security Test Runner

Below is the conceptual blueprint of the automated test suite configured to verify the Zero-Trust ruleset:

```typescript
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';

describe('Product Catalog Security Rules', () => {
  let testEnv;

  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'gen-lang-client-0566278135',
      firestore: {
        rules: require('fs').readFileSync('firestore.rules', 'utf8')
      }
    });
  });

  after(async () => {
    await testEnv.cleanup();
  });

  it('blocks unauthenticated creation (Attack 1)', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    const productRef = unauthedDb.collection('products').doc('prod123');
    await assertFails(productRef.set({ name: 'Hack' }));
  });

  it('blocks UID spoofing (Attack 2)', async () => {
    const authedDb = testEnv.authenticatedContext('attacker_uid').firestore();
    const productRef = authedDb.collection('products').doc('prod123');
    await assertFails(productRef.set({
      name: 'Fake product',
      price: 10,
      stock: 5,
      category: 'Electronics',
      createdBy: 'victim_uid',
      creatorEmail: 'victim@test.com',
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  });
});
```
