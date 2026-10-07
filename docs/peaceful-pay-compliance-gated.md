# Peaceful Pay — compliance-gated program specification

Status: PROPOSED / NOT AVAILABLE FOR CUSTOMER ENROLLMENT. Owner and Missouri consumer-finance counsel approval required before activation.

## Product
Peaceful Motors LLC may offer an installment arrangement for eligible auto-repair services only after legal and processor approval. Do not imply guaranteed approval, zero interest, or instant financing. Do not change the existing $50 booking hold or any Stripe production Payment Link.

## Drafting and settlement
Use the existing verified Peaceful Motors Stripe merchant account only after confirming its capabilities, bank payout destination, and support for the selected payment method. A customer explicitly selects a card or bank account and authorizes scheduled debits using provider-hosted payment-method collection (no raw card/bank details in Supabase). Collect down payment through hosted checkout. Store provider customer/payment-method references and mandate/consent evidence, not PAN, CVV, bank routing/account numbers, or login credentials.

Scheduled installments: exact amount, due date, frequency, number of payments, total, prepayment terms, and any legally permitted charges displayed before consent. For ACH obtain a separately provable authorization with required disclosures, revocation mechanism, and change notices; observe NACHA/Reg E and processor rules. For card off-session payments obtain express consent and comply with card-network stored credential requirements. A due-date attempt is not a guaranteed same-day settlement. Reconcile webhooks to idempotent installment records, update ledger only on confirmed successful payment, and handle pending, failure, disputes, returns, refunds, partial payments, and retries within law/provider limits. Payout to the verified business bank account is handled by the merchant processor on its payout schedule. Never claim funds are held in a bank account as collateral.

A card authorization hold is temporary, subject to processor/card-network limits, and is NOT collateral for a long-term payment plan. Do not repeatedly reauthorize to lock a customer's credit line. Ordinary ACH authorization does NOT create a hold or freeze on a customer's bank account. Never request PINs or online banking credentials.

## Verification and underwriting
Verify identity and ability to pay through approved consent-based providers. Define objective, documented, fair criteria and human review/appeal. Do not use protected traits or proxies. If consumer reports are used, obtain permissible purpose, meet FCRA/ECOA/Reg B adverse-action requirements, and comply with applicable privacy and state laws. No self-built opaque credit score. No automatic denial solely on an unverified signal.

## Collateral
Do not take a customer's license, SSN card, debit card, keys, phone, tools, or title as informal collateral. Any consensual security interest in a vehicle requires separate Missouri attorney-approved documentation, proper lien perfection and disclosures; do not assert automatic repossession rights. Distinguish mechanic's liens from financing liens. No vehicle retention/repo automation.

## Required legal gate
Missouri consumer-finance counsel must confirm licensing/exemptions, TILA/Reg Z disclosures and thresholds, retail installment / credit-sale treatment, ECOA/Reg B, FCRA, EFTA/Reg E, ACH/NACHA, card rules, UCC/title liens, usury/fees, collections and privacy before any public application, offer, recurring debit, lien, or approval. Any interest, service fee, late fee, or finance charge is OFF until counsel approves the actual amount and disclosures.

## Owner app proposed screens
Draft applications, identity/verification status, documents/consents, proposed schedule, owner approval, agreement signature, installment ledger, payout reconciliation, exception queue, delinquency handling, audit log. Restrict sensitive data to approved office roles with RLS and immutable event logs. No real credit decisions or charges in tests.

## Customer website proposed content
“Need flexibility with a repair bill? Ask Peaceful Motors about payment options. In-house installment plans are under review and are not currently available. Existing booking and payment terms remain unchanged.” Do not add a live Apply button or claim availability until launch gate passes.

## Release acceptance
Counsel approval documented; processor account/bank destination confirmed by owner; signed disclosures; customer opt-in for method and schedule; compliant cancellation/revocation; idempotent test-mode debits/webhooks; RLS and security tests; correct payout reconciliation; customer receipts; refunds/disputes; mobile E2E; rollback. Deploy only after owner explicitly authorizes production activation.
