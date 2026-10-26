// Real disposable GoTrue-issued sessions + PostgREST. Never point at a hosted project.
const {execFileSync}=require('node:child_process');const assert=require('node:assert/strict');
const sql=q=>execFileSync('psql',['-v','ON_ERROR_STOP=1','-c',q],{stdio:'pipe'});
const auth='http://127.0.0.1:9999',rest='http://127.0.0.1:3000';
async function request(url,body,token){const r=await fetch(url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}return{status:r.status,data};}
(async()=>{
 const signup=await request(auth+'/signup',{email:'android-test@example.invalid',password:'Disposable-test-only-2026!',data:{full_name:'Amina Private Family'}});assert.equal(signup.status,200,JSON.stringify(signup.data));
 const login=await request(auth+'/token?grant_type=password',{email:'android-test@example.invalid',password:'Disposable-test-only-2026!'});assert.equal(login.status,200);const token=login.data.access_token,id=login.data.user.id;assert.ok(token);
 // Deliberately model the reported pre-existing missing profile before first interaction.
 sql(`delete from public.profiles where id='${id}';`);
 let r=await request(rest+'/rpc/ensure_my_profile',{},token);assert.ok(r.status<300,JSON.stringify(r));
 r=await request(rest+'/profiles?select=id,role',null,token);assert.equal(r.data.length,1);assert.equal(r.data[0].id,id);assert.equal(r.data[0].role,'student');
 r=await request(rest+'/demand_requests',{user_id:id,title:'Need a calculator'},token);assert.ok(r.status<300,JSON.stringify(r));
 sql(`insert into auth.users(id,email) values('00000000-0000-0000-0000-000000000099','fixture@example.invalid'); insert into public.profiles(id,full_name) values('00000000-0000-0000-0000-000000000099','Fixture Vendor') on conflict do nothing; alter table public.vendors disable trigger require_vendor_identity; insert into public.vendors(id,owner_id,store_name,slug,whatsapp_number,status) values('10000000-0000-0000-0000-000000000099','00000000-0000-0000-0000-000000000099','Fixture store','fixture-store','2348012345678','approved'); alter table public.vendors enable trigger require_vendor_identity; insert into public.products(id,vendor_id,title,slug,price,status) values('30000000-0000-0000-0000-000000000099','10000000-0000-0000-0000-000000000099','Calculator','calculator',100,'draft'); alter table public.products disable trigger user; update public.products set status='approved' where id='30000000-0000-0000-0000-000000000099'; alter table public.products enable trigger user; insert into public.events(id,title,slug,starts_at,status) values('20000000-0000-0000-0000-000000000099','Fixture event','fixture-event',now(),'published');`);
 r=await request(rest+'/rpc/set_product_like',{p_product:'30000000-0000-0000-0000-000000000099',p_like:true},token);assert.ok(r.status<300,JSON.stringify(r));assert.equal(Number(r.data[0].like_count),1);
 r=await request(rest+'/rpc/set_event_like',{p_event:'20000000-0000-0000-0000-000000000099',p_like:true},token);assert.ok(r.status<300,JSON.stringify(r));
 r=await request(rest+'/rpc/add_event_comment',{p_event:'20000000-0000-0000-0000-000000000099',p_body:'See you there'},token);assert.ok(r.status<300,JSON.stringify(r));
 r=await request(rest+'/event_comments?select=first_name,body',null,token);assert.equal(r.data[0].first_name,'Amina');
 r=await request(rest+'/event_comments?select=user_id',null,token);assert.ok(r.status>=400,'Private comment identifiers exposed');
 r=await request(rest+'/rpc/admin_moderate_report',{p_report:'00000000-0000-0000-0000-000000000099',p_action:'dismiss',p_reason:'Not an admin',p_expected:'open'},token);assert.ok(r.status>=400);
 r=await request(rest+'/rpc/ensure_my_profile',{});assert.ok(r.status>=400);
 console.log('Real GoTrue login + authenticated PostgREST: profile repair, requests, product likes, event likes/comments, identifier privacy and admin denial PASS.');
})().catch(e=>{console.error(e);process.exitCode=1});
