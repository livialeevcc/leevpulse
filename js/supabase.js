const sb = window.supabase.createClient(
  'https://buyjbhoyslfdbpmvrvkp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1eWpiaG95c2xmZGJwbXZydmtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTM5MzAsImV4cCI6MjA5MTkyOTkzMH0.92qNTJPdsQEE1SLvAiZ_bly9dy0MpXqzQZ8qNMrwhUY'
);

let tenantAtivo = null;

async function carregarTenants(userId) {
  const { data } = await sb
    .from('tenant_users')
    .select('tenant_id, role, tenants(nome)')
    .eq('user_id', userId);
  return data || [];
}

function getTenantAtivo() {
  return tenantAtivo;
}

function setTenantAtivo(slug) {
  tenantAtivo = slug;
  sessionStorage.setItem('tenant_ativo', slug);
}

function inicializarTenant() {
  const salvo = sessionStorage.getItem('tenant_ativo');
  if (salvo) tenantAtivo = salvo;
}

inicializarTenant();