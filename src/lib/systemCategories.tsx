import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface SystemCategory {
  id: number;
  name: string;
  icon: string;
}

const ICON_EMOJI: Record<string, string> = {
  food:           '🍽️',
  fitness:        '💪',
  travel:         '✈️',
  entertainment:  '🎬',
  savings:        '🐷',
  utilities:      '⚡',
  shopping:       '🛍️',
  health:         '❤️',
  transportation: '🚗',
};

export function getCatEmoji(icon: string): string {
  return ICON_EMOJI[icon] ?? '📁';
}

export function useSystemCategories() {
  const [categories, setCategories] = useState<SystemCategory[]>([]);
  useEffect(() => {
    supabase.from('system_categories').select('id,name,icon').order('name')
      .then(({ data }) => setCategories(data ?? []));
  }, []);
  return categories;
}
