import nodemailer from "nodemailer";

export async function sendPasswordResetEmail(to:string, name:string, resetUrl:string){
 const host=process.env.SMTP_HOST||"smtp.gmail.com";
 const port=Number(process.env.SMTP_PORT||465);
 const user=process.env.SMTP_USER;
 const pass=process.env.SMTP_PASSWORD;
 const from=process.env.EMAIL_FROM||user;
 if(!user||!pass||!from) throw new Error("Email service is not configured");
 const transport=nodemailer.createTransport({host,port,secure:port===465,auth:{user,pass}});
 await transport.sendMail({from:`AI StorySprint Editing <${from}>`,to,subject:"Reset your AI StorySprint password",text:`Hello ${name},\n\nUse this secure link to reset your password. It expires in one hour:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,html:`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2 style="color:#5b4bdb">AI StorySprint Editing</h2><p>Hello ${escapeHtml(name)},</p><p>Use the button below to reset your password. This link expires in one hour and can be used only once.</p><p><a href="${resetUrl}" style="display:inline-block;padding:12px 20px;border-radius:9px;background:#5b4bdb;color:white;text-decoration:none;font-weight:bold">Reset password</a></p><p style="color:#667085;font-size:13px">If you did not request this, you can safely ignore this email.</p></div>`});
}
export async function sendAccountCreatedEmail(to:string,name:string){await sendSimple(to,"Your AI StorySprint account is ready",name,"Your account has been created. Your course enrollment is pending administrator approval. We’ll notify you when access is activated.");}
export async function sendEnrollmentApprovedEmail(to:string,name:string,loginUrl:string){await sendSimple(to,"Your AI StorySprint enrollment is approved",name,`Your course access is now active. Log in and begin learning here: ${loginUrl}`,loginUrl,"Open your course");}
async function sendSimple(to:string,subject:string,name:string,message:string,buttonUrl?:string,buttonText?:string){const host=process.env.SMTP_HOST||"smtp.gmail.com";const port=Number(process.env.SMTP_PORT||465);const user=process.env.SMTP_USER;const pass=process.env.SMTP_PASSWORD;const from=process.env.EMAIL_FROM||user;if(!user||!pass||!from)throw new Error("Email service is not configured");const transport=nodemailer.createTransport({host,port,secure:port===465,auth:{user,pass}});await transport.sendMail({from:`AI StorySprint Editing <${from}>`,to,subject,text:`Hello ${name},\n\n${message}`,html:`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2 style="color:#5b4bdb">AI StorySprint Editing</h2><p>Hello ${escapeHtml(name)},</p><p>${escapeHtml(message)}</p>${buttonUrl?`<p><a href="${buttonUrl}" style="display:inline-block;padding:12px 20px;border-radius:9px;background:#5b4bdb;color:white;text-decoration:none;font-weight:bold">${buttonText}</a></p>`:""}</div>`});}
function escapeHtml(value:string){return value.replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]!));}
