# Account, billing, usage, and themes

## Current local MVP

Settings is divided into Account, Usage & API, Billing, and Appearance. Account
and Billing expose the intended product flow without pretending that a hosted
identity or payment service exists. Submitting the preview sign-in form or
choosing the upgrade plan explains that no credential or payment session was
created.

OpenAI remains a bring-your-own-key provider. Its key is written only to macOS
Keychain by the local Python service. A normal OpenAI project key cannot read the
provider account's credit balance, so the UI distinguishes provider-managed BYOK
billing from future marul3D-hosted credits. The local prompt count shown today is
derived from the selected object's persisted agent conversation.

## Hosted account boundary

A production account service should own only identity and cloud product data:

- user and organization identity;
- plan, entitlement, and hosted-credit ledger;
- Stripe customer, checkout-session, and subscription identifiers;
- marketplace purchases and seller records;
- explicit cross-device scan or document sync metadata.

Local CAD documents, B-rep caches, checkpoint history, and provider API keys do
not belong in that service. Authentication should use short-lived sessions with
PKCE/passkeys support. Stripe Checkout and the customer portal should be created
server-side, with subscription state updated from verified, idempotent Stripe
webhooks. The browser must never receive Stripe secret keys.

Suggested hosted endpoints are `/auth/*`, `/account`, `/usage`,
`/billing/checkout`, `/billing/portal`, and `/billing/webhooks/stripe`. They are
deliberately absent from the local FastAPI process until a deployment, database,
identity provider, Stripe account, prices, and webhook secret are chosen.

## Appearance engine

Theme preference is stored locally in the browser. Fixed choices are Marul,
Aerospace, Cyberpunk, and Kawaii. Adaptive mode applies transparent local keyword
rules to workspace, project, object, and feature names:

- aircraft, flight, turbine, rocket, and related work selects Aerospace;
- Labubu, toy, character, figurine, and similar work selects Kawaii;
- robotics, mech, neon, and futuristic work selects Cyberpunk;
- unmatched projects retain the Marul theme.

This first implementation is deterministic, instant, private, and easy to
override. A later classifier can consume richer local document-understanding
signals, but it should return a theme recommendation rather than directly mutate
the UI, and it should preserve the user's explicit fixed choice.
