// Produces MIME locally; never connects to SMTP or sends email.
const assert=require('node:assert/strict');
(async()=>{
 const mail=require('nodemailer');
 const transport=mail.createTransport({streamTransport:true,buffer:true,newline:'unix'});
 const result=await transport.sendMail({from:'HikmahHub <noreply@example.invalid>',to:'Student <student@example.invalid>',subject:'Vendor application update',text:'Open your vendor dashboard.',html:'<p>Open your vendor dashboard.</p>',disableFileAccess:true,disableUrlAccess:true});
 assert.ok(result.message.toString().includes('Vendor application update'));
 assert.deepEqual(result.envelope.to,['student@example.invalid']);
 console.log('Patched Nodemailer MIME/envelope compatibility: PASS; no SMTP connection.');
})().catch(e=>{console.error(e);process.exitCode=1});
