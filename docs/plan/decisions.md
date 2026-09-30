# Workflow Decisions — Confirmed with Principal

## Amount-based routing (Ambiguity A + threshold ambiguity, both resolved)

CONFIRMED THRESHOLDS: ₹50,000 and ₹5,00,000 are authoritative (NOT the
₹1,50,000 / ₹15,00,000 figures that appeared elsewhere in the requirements
doc — those were a documentation error and should be disregarded).

Every request, at every amount, follows this sequence:

1. Requester submits.
2. Purchase Committee reviews for validity/completeness only — checks
   whether required documents (e.g. quotation) are present and the request
   is properly filled out. PC does NOT decide or approve anything. If the
   quotation is insufficient or changes are needed, PC sends it back for
   resubmission (does not forward it as-is).
3. Once PC confirms it's valid, it goes to the Principal. The Principal
   ALWAYS sees every request, regardless of amount — this stage is never
   skipped.
4. Decision authority from here depends on amount:
   - ₹0 – ₹50,000: Principal decides directly (approve/reject). Principal
     is the final authority at this band.
   - ₹50,000 – ₹5,00,000: decision authority moves to CDC. The Principal's
     role here is to review and pass it to CDC (Principal does not make
     the final call at this band, but still sees it first per step 3).
   - Above ₹5,00,000: decision authority moves to Chairman + Vice
     Chairman jointly (see below).

## CDC two-approver model (Ambiguity B, resolved)

CDC's "two members" are two DISTINCT ROLES, not two arbitrary people:
- CDC Grant Member
- CDC Non-Grant Member

(These already exist as role codes in the seed data: CDC_GRANT_MEMBER and
CDC_NON_GRANT_MEMBER — reuse these, do not invent new role codes.)

BOTH approvals are required — neither alone is sufficient. There is NO
required order between them; they can act independently/in either order
("done together," not sequential). The request only advances past CDC once
both roles have recorded an approval. (Reject-handling — whether a single
rejection kills the request outright or sends it back for resubmission —
is not yet specified; confirm if/when it comes up during Phase 2/3.)

Note: the generic CDC_MEMBER role code that also exists in seed data is
likely legacy/unused under this model — flag it in Phase 1/2 analysis
rather than assuming its purpose; confirm before removing it.

## Chairman / Vice Chairman (Vice Chairman ambiguity, resolved)

For requests above ₹5,00,000, the Chairman and Vice Chairman decide
JOINTLY — "together," not sequentially and not as a review-only role for
either of them. Both are active decision-makers at this stage, not merely
reviewers. (Whether "jointly" means both must independently record
approval, similar to the CDC both-required model, or a single combined
decision record — confirm if it comes up during Phase 2 schema design;
default assumption unless corrected: same both-required pattern as CDC,
for consistency.)