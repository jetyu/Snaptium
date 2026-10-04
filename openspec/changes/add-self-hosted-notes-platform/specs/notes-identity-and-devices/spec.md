## ADDED Requirements

### Requirement: Controlled server initialization
The system SHALL require a one-time initialization flow to create the first administrator before normal account access is enabled.

#### Scenario: Fresh server
- **WHEN** an operator accesses an uninitialized deployment with the required initialization authority
- **THEN** the system allows creation of the first administrator and permanently closes the bootstrap operation after success

### Requirement: Secure password verification
The server MUST store password verifiers using Argon2id with versioned parameters and MUST never store or log plaintext passwords.

#### Scenario: Password authentication
- **WHEN** a user submits valid credentials
- **THEN** the server verifies the password using the stored Argon2id parameters and creates an appropriate session without returning the verifier

### Requirement: Separate Web and native sessions
The system SHALL use secure browser cookies for Web sessions and independently revocable device credentials for native clients.

#### Scenario: Native device sign-in
- **WHEN** a user authenticates a native client
- **THEN** the server registers a named device and issues credentials scoped to that device session

### Requirement: Device revocation
The system SHALL allow a user to list and revoke their authenticated devices without affecting other active devices unless explicitly requested.

#### Scenario: Lost device revoked
- **WHEN** a user revokes a lost Windows device
- **THEN** credentials issued to that device can no longer access or synchronize user data

### Requirement: Owner-scoped authorization
The server MUST verify ownership for every note, attachment, synchronization, export, and device operation.

#### Scenario: Cross-user entity identifier
- **WHEN** an authenticated user submits another user's entity identifier
- **THEN** the server denies the operation without revealing whether the entity exists

### Requirement: Authentication abuse controls
The server SHALL rate-limit sensitive authentication and initialization operations and SHALL avoid account-enumerating responses.

#### Scenario: Repeated invalid login
- **WHEN** a source repeatedly submits invalid credentials
- **THEN** the server applies documented throttling while returning a generic authentication failure

### Requirement: Explicit security claims
The product SHALL state that self-hosting does not provide end-to-end encryption and that a server operator can access stored content.

#### Scenario: User reviews security information
- **WHEN** a user opens the security or privacy documentation
- **THEN** the trust boundary and absence of end-to-end encryption are presented unambiguously
