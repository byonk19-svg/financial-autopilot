import { supabase } from './supabase'

export async function hasActiveSimplefinConnection(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('bank_connections')
    .select('id')
    .eq('user_id', userId)
    .eq('provider', 'simplefin')
    .eq('status', 'active')
    .limit(1)

  if (error) {
    throw new Error('Could not check bank connection status.')
  }

  return (data?.length ?? 0) > 0
}
