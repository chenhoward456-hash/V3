const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
env.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val.length) process.env[key.trim()] = val.join('=').trim();
});
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('id, title, slug, date, category')
    .order('date', { ascending: false });

  if (error) { console.log('ERROR:', error); return; }
  console.log('Total posts in DB:', data.length);
  data.forEach(p => console.log(' -', p.title, '|', p.slug, '|', p.date));
}
main();
