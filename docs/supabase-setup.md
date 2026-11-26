# Connect Supabase (database and sign-in)

Supabase is already integrated in SchemeSetu. It stores account email addresses and app data, handles password security, and provides a web dashboard to inspect registered users. Passwords are managed by Supabase Auth; the app never stores or displays plain-text passwords.

## One-time setup

1. Create a project at [supabase.com](https://supabase.com/) and wait for it to finish provisioning.
2. In the project dashboard, open **SQL Editor**. Run `supabase/migrations/0001_initial_schema.sql`, then run `supabase/migrations/0002_eligibility_rules.sql`.
3. Open **Project Settings → API** (or **API Keys**) and copy the Project URL, the publishable/anon key, and the secret/service-role key.
4. Copy `.env.example` to `.env` in the repository root. Fill in these values:

   ```dotenv
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-publishable-or-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-secret-or-service-role-key
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
   ```

   Use the same Project URL and public key in both places. The service-role/secret key belongs only in `SUPABASE_SERVICE_ROLE_KEY`; never put it in a `VITE_` variable or share it publicly. `.env` is ignored by Git.
5. In **Authentication → URL Configuration**, set the local site URL to `http://localhost:3000`. Enable email/password sign-in. For local development, you can turn off email confirmation under **Authentication → Providers → Email** if you want accounts to sign in immediately; otherwise, users must click the verification link.
6. Restart `npm run dev`. Open `http://localhost:3000`, create an account, and sign in.

## Where to see accounts and data

- **Authentication → Users** lists registered accounts and email/verification status. Supabase does not reveal anyone's password.
- **Table Editor → profiles** shows the account ID, email, and optional display name.
- **Table Editor → student_profiles** shows eligibility profile details saved with the user's consent.

The migrations enable row-level security so signed-in users can access their own app data. Avoid manually editing Supabase's internal `auth.users` table. If account creation fails, first check that both frontend variables start with `VITE_` and restart the dev server after editing `.env`.
