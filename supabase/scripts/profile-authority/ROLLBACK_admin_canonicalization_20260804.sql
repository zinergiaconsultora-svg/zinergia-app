-- ROLLBACK for the 2026-08-04 admin canonicalization.
--
-- Context: the production contract gate reported canonical_active_admins=0 and
-- admin_noncanonical_tuple=1. The Zinergia admin (the account that creates collaborator
-- profiles) had a franchise_id set, which a canonical admin must not have. Applying the
-- ZIN-SDD-041 contract in that state would have locked authority management out of the
-- application, and 20260803191000 would have aborted on its CHECK.
--
-- Values captured immediately before the change:
--   admin_id              8ec36524-22b8-4290-9135-3741d8fea728
--   previous_franchise_id e4d11b30-6eb1-45b9-981d-a8b8eef14325
--   previous_parent_id    NULL (already correct, untouched)
--   authority_version     0
--
-- The admin owned 0 clients and is the parent of 5 profiles; neither relationship was
-- modified, so this rollback restores the exact prior state.
--
-- Only run this if the canonicalization must be undone. Note it puts the admin back into a
-- state where the contract migrations cannot be applied.

UPDATE public.profiles
SET franchise_id = 'e4d11b30-6eb1-45b9-981d-a8b8eef14325'
WHERE id = '8ec36524-22b8-4290-9135-3741d8fea728'
  AND role = 'admin'
  AND franchise_id IS NULL;
