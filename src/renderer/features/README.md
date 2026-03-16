# Feature Modules

Each feature should be self-contained:

- `components/` UI pieces only for this feature
- `composables/` feature state and business logic
- `services/` feature data access and orchestration
- `store/` optional Pinia store
- `constants/` feature-scoped constants

Suggested flow:

`view -> feature component -> feature composable -> shared/feature service -> bridge/api`
