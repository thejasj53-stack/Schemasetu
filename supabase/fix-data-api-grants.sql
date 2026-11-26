-- Grant the Data API roles table privileges; row-level security still controls which rows they can access.
grant usage on schema public to anon, authenticated, service_role;

grant select on public.scholarships,
  public.scholarship_eligibility_rules,
  public.scholarship_documents
to anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.student_profiles,
  public.saved_scholarships,
  public.applications,
  public.user_notification_preferences,
  public.chatbot_conversations,
  public.chatbot_messages,
  public.student_documents,
  public.document_analysis,
  public.admin_users,
  public.web_push_subscriptions
to authenticated;
grant select on public.notifications to authenticated;

grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
