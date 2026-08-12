# Decision Register

| ID    | Decision                                                                     | Rationale                                                                                                               | Status   |
| ----- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| D-001 | Build only an internal synthetic vertical slice                              | The product brief requires discovery before a full build; the execution prompt explicitly frames this slice as evidence | Accepted |
| D-002 | Use a TypeScript modular monolith                                            | Matches the greenfield default and keeps business rules outside prompts/UI                                              | Accepted |
| D-003 | Use Vinext/React for the local mobile web surface                            | Bundled supported starter provides a server-capable React path and local preview                                        | Accepted |
| D-004 | Keep PostgreSQL-oriented persistence and a local deterministic adapter       | Preserves the architectural default while keeping CI independent of Docker/paid services                                | Accepted |
| D-005 | Freeze `handwerk.vertical-slice.v1` contracts before workers start           | Ten parallel workstreams need one compatible domain, API, event, and extraction model                                   | Accepted |
| D-006 | Represent money as integer EUR minor units and quantities as decimal strings | Avoids binary floating-point money and preserves explicit rounding                                                      | Accepted |
| D-007 | Treat photos as `CONTEXT_ONLY`; explicit measurements as `AUTHORITATIVE`     | Enforces the no-photo-measurement invariant in the type contract                                                        | Accepted |
| D-008 | Use deterministic fake AI by default; any live adapter stays feature-flagged | Demo and CI must run without an external key or network                                                                 | Accepted |
| D-009 | No Sites or other production deployment                                      | Explicit user constraint                                                                                                | Accepted |
