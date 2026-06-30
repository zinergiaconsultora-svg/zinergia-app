-- Allow agents to delete their own clients. Admins are already covered by
-- rls_clients_admin_all, and franchise-wide deletes stay server-authorized.
DROP POLICY IF EXISTS rls_clients_agent_delete ON public.clients;

CREATE POLICY rls_clients_agent_delete
  ON public.clients
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());
