import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface SystemCategory {
  id: number;
  name: string;
  icon: string;
}

export function useSystemCategories() {
  const [categories, setCategories] = useState<SystemCategory[]>([]);
  useEffect(() => {
    supabase.from('system_categories').select('id,name,icon').order('name')
      .then(({ data }) => setCategories(data ?? []));
  }, []);
  return categories;
}
