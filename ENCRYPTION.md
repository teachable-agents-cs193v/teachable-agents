# Encryption

## What's encrypted

In terms of what is encrypted, the transcript, so the student and Pip's messages (column is `teaching_sessions.messages`), pre-explanation (`teaching_sessions.pre_explanation`), and reflection (`teaching_sessions.reflection`) are encrypted. Pip's notebook (`teaching_sessions.learner_state`) will be encrypted the same way once #42 merges, using migration `0004`. Names, emails, and login tokens, which correspond to `users` and `auth_session`, still need to be covered in issue #54.

Things like session ID, owner ID, topic, status, timestamps, and Pip's position in the conversation are not encrypted.

## How it works

It works by using AES-256-GCM that hides the data and detects tampering, using the Node built-in library `crypto`. There is a different key for each student and field. There is a master key, `ENCRYPTION_MASTER_KEY`, to generate a separate key for each student-field pair, using a method called HKDF-SHA256. Each save uses a new random 12-byte IV, so if a user saves the same text twice, there are different values stored. Also, the student's ID and the field name are checked during decryption, which helps prevent the encrypted data from being used for a different student or field. The application separately checks authorization to ensure that only authorized users can access the data.

It is stored as `v1:<iv>:<ciphertext>:<tag>`. On the server, in `src/lib/persistence/server.ts`, the data is encrypted before it is saved and decrypted after it is read, and this is encryption at rest in the database. Also, between the browser and server, the data is protected by HTTPS with TLS.

The key is generated with `openssl rand -base64 32`, generating 32 random bytes and is stored in Vercel's environment variables and marked as Sensitive, and the key itself is never in the repo. Each environment (Development, Preview, Production) should have a different key, with a backup stored outside of the repo. Tests use test-only keys. If `ENCRYPTION_MASTER_KEY` is lost and there is no backup, then the encrypted data can't be recovered.

## Safeguards and limitations

Additional safeguards are in place, such as the database refusing unencrypted data in the protected columns, damaged/tampered values throwing an error, a missing/malformed key stopping encryption operations, and errors and logs never showing the data or the key. Still, there are a few limitations, such as there is no key rotation yet, values aren't tied to a specific session, and the key is only checked on first use. Account data also needs to be covered in Issue #54.

Names, email addresses, and authentication tokens are not encrypted at the application level because email lookup requires a searchable keyed hash, and encrypting Better Auth-managed data would require changes to its internal behavior. For now, database access is restricted to Chase and Betania, Neon encrypts data at rest, sessions expire, and IP addresses and browser information are no longer stored. Further encryption improvements are tracked in #54.

The encryption mainly protects the data if the database or a backup is leaked, since without the key, the values can't be read. However, it won't protect against someone who has both the database and the key, and the running server can also decrypt the data. Messages sent to the AI provider are covered separately in issue #59.

## Deploying and testing

For deploying and checking, you must set `ENCRYPTION_MASTER_KEY` before deploying and apply the migration, and all steps are in [`docs/DEPLOY.md`](docs/DEPLOY.md). To check production, `SELECT LEFT(messages, 3) FROM teaching_sessions;` should show `v1:` for saved sessions. To test the encryption, there are automated tests that test the encryption tool itself and the saving and loading.
