# Community CAD marketplace

The Community section is deliberately split into two layers.

## Local MVP

- Browse a curated catalog in a card grid.
- Search and filter by category, free/paid status, and maximum price.
- Inspect formats, license, creator, ratings, and price.
- Create and delete a private seller listing draft from the currently selected local CAD object.
- Keep the draft and its source-object label in the local marul3D data directory.
- Never upload a CAD file or claim that a payment completed.

The built-in catalog is presentation data for the marketplace UX. `commerce_enabled` is
false, so acquisition buttons remain disabled and explain which hosted capabilities are
missing.

## Hosted commerce boundary

A production marketplace needs authenticated accounts, object storage, signed downloads,
listing moderation, license acceptance, malware/file validation, order records, seller
onboarding and verification, payouts, refunds, disputes, tax handling, and audit logs.

The recommended first payment adapter is Stripe Connect, behind a provider-neutral
`CommerceProvider` interface. The hosted service should own listing publication and order
state. The local API should only upload an explicit versioned export after the seller
reviews and confirms the publication request.

Suggested lifecycle:

1. Local seller draft
2. Export review and upload consent
3. Server-side CAD validation and preview generation
4. Moderation
5. Published listing
6. Checkout and license acceptance
7. Signed, expiring file delivery
8. Refund/dispute and payout handling

Never store card data, seller identity documents, or payout credentials in the local
marul3D API.
