// Shared Supabase browser client for the carousel helpers.
// Use the app's existing browser-client factory so auth/session behavior matches
// the rest of the admin and account surfaces.

'use client';

import { createClient } from "../../src/lib/supabase/client";

export const supabase = createClient();
