const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://vzylpnuvsuianmuwqsnr.supabase.co', 'sb_publishable_SE1OPKy63BYHkZfQkbIb_A_nAgXKGTQ');
(async () => {
  const { data: recs } = await supabase.from('recordings').select('user_id').order('created_at', { ascending: false }).limit(1);
  const uid = recs?.[0]?.user_id;
  console.log('owner uid', uid);
  const { data: cats } = await supabase.from('categories').select('id,name,icon,color').eq('user_id', uid);
  console.log('OWNER CATS', JSON.stringify(cats, null, 1));
})();