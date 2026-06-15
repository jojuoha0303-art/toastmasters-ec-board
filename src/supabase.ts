import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://shzfjiujdziuosefqxsl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoemZqaXVqZHppdW9zZWZxeHNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5ODc0OTIsImV4cCI6MjA5NTU2MzQ5Mn0.fuPqex83Ik8xmkhD6iwbFh3cBQqLW2mMSIdP1fBYh0U';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
