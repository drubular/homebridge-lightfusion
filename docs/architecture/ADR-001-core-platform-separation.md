# ADR-001: Separate LightFusion Core from Platform Interfaces

## Status

Accepted

## Context

LightFusion began as a Homebridge plugin for synchronizing and calibrating mixed-brand smart lighting.

The synchronization, calibration, device-state, and provider logic may also be useful outside Homebridge. Tying that logic directly to Homebridge would make future interfaces harder to build and maintain.

## Decision

LightFusion will separate its reusable core engine from platform-specific interfaces.

LightFusion Core will contain:

- Common light and group models
- Provider interfaces
- Synchronization logic
- Calibration logic
- State management

Platform packages will connect the core engine to external systems.

The first platform package will provide a Homebridge interface and virtual HomeKit accessories.

## Consequences

Benefits:

- Core functionality can be tested independently.
- Additional providers can be added without changing platform code.
- Future interfaces can reuse the same engine.
- Homebridge-specific dependencies remain outside the core package.

Costs:

- The repository requires a package-based structure.
- Initial build tooling is more involved.
- Package boundaries must remain clearly defined.