# Inbox UI / transport plan (plan only — Oct 5 final pass)

## Goal
Smallest usable Owner Inbox on top of `communication_threads` / `communication_events` (foundation applied).

## Owner app card (v21+)
- New card on owner-app: thread list (folder=inbox, unarchived), last body snippet, channel badge, starred/archive toggles.
- Detail pane: chronological events; composer for `channel=email` (customer visibility) and `channel=internal_note` (forced internal; owner/admin/service_writer only).
- Filters: folder, starred, channel, linked customer/job if present.
- No SMS UI yet.

## Inbound email
- Resend inbound webhook → edge function (new, verify Resend signature) → upsert thread by `contact_email` + shop → insert `communication_events` (`channel=email`, `direction=inbound`, `visibility=customer`, `folder=inbox`).
- Do not change MX / Resend domain config in this pass beyond webhook destination.

## Outbound email
- Reuse existing Resend send path; on success insert outbound event (`folder=sent`) and bump thread `last_activity_at`.

## SMS (later)
- Twilio inbound/outbound → same tables with `channel=sms|mms`; keep separate from email UI until Opt-in/TCPA reviewed.

## Out of scope this pass
- Voice/voicemail UI, payment links, MX changes, Stripe.
