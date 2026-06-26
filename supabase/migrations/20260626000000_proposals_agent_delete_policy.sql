-- Allow agents to delete proposals belonging to their franchise
CREATE POLICY rls_proposals_agent_delete
  ON public.proposals
  FOR DELETE
  USING (
    franchise_id = public.get_my_franchise_id()
    OR EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = proposals.client_id
        AND clients.owner_id = auth.uid()
    )
  );
