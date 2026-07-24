## ADDED Requirements

### Requirement: Curated OpenAI-compatible provider presets

The system SHALL offer Qwen (Model Studio), Doubao (Volcengine Ark), Kimi, Zhipu AI (GLM), and Grok (xAI) as selectable AI provider presets without separating them into domestic or international groups.

#### Scenario: Selecting a requested provider

- **WHEN** a user selects one of the five curated provider presets for a new AI source
- **THEN** the source receives that provider's documented default endpoint and chat capability
- **AND** the user can enter an API key and model and edit the endpoint before saving.

### Requirement: Provider identity and presentation

The system SHALL assign each curated provider a stable identity, display label, and local brand icon in the provider selector and saved-source card.

#### Scenario: Viewing a selected provider

- **WHEN** a user opens the provider selector or views an AI source configured for a curated provider
- **THEN** the matching provider label and local icon are displayed.

### Requirement: Endpoint-based provider inference

The system SHALL infer the curated provider identity when an AI source base URL matches its known public endpoint domain.

#### Scenario: Loading an existing compatible source

- **WHEN** an existing source uses a recognized Qwen, Doubao, Kimi, Zhipu AI, or Grok endpoint
- **THEN** the system identifies it as the corresponding curated provider instead of the generic OpenAI-compatible provider.

### Requirement: Chat model construction

The system SHALL construct chat models for the curated providers through the existing OpenAI-compatible adapter and SHALL not advertise embedding or reranking capabilities for them.

#### Scenario: Using a curated provider for chat

- **WHEN** a configured curated provider is used for a chat-capable AI source
- **THEN** the system sends requests through its configured endpoint using the OpenAI-compatible chat adapter.
