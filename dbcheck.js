const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://vzylpnuvsuianmuwqsnr.supabase.co', 'sb_publishable_SE1OPKy63BYHkZfQkbIb_A_nAgXKGTQ');
(async () => {
  const { data: cats, error: ce } = await supabase.from('categories').select('id,name,icon,color,is_default').limit(30);
  console.log('CATS ERR', ce);
  console.log('CATS', JSON.stringify(cats, null, 1));
  const { data: recs, error: re } = await supabase.from('recordings').select('id,name,type,category_id,created_at').order('created_at', { ascending: false }).limit(10);
  console.log('RECS ERR', re);
  console.log('RECS', JSON.stringify(recs, null, 1));
})();