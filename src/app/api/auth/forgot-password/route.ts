import { NextRequest,NextResponse } from "next/server";
import { db } from "@/db";
import { users,passwordResetTokens } from "@/db/schema";
import { eq,sql } from "drizzle-orm";
import crypto from "crypto";
import { sendPasswordResetEmail } from "@/lib/email";
const generic={success:true,message:"If an account exists for that email, a reset link has been sent."};
export async function POST(req:NextRequest){
 try{
  const {email}=await req.json(); if(typeof email!=="string"||!email.trim())return NextResponse.json(generic);
  const found=await db.select().from(users).where(sql`lower(${users.email})=lower(${email.trim()})`).limit(1);if(!found.length)return NextResponse.json(generic);
  const user=found[0];const recent=await db.select().from(passwordResetTokens).where(sql`${passwordResetTokens.userId}=${user.id} AND ${passwordResetTokens.createdAt}>now()-interval '10 minutes'`).limit(1);if(recent.length)return NextResponse.json(generic);
  const token=crypto.randomBytes(32).toString("hex");const tokenHash=crypto.createHash("sha256").update(token).digest("hex");
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId,user.id));
  await db.insert(passwordResetTokens).values({tokenHash,userId:user.id,expiresAt:new Date(Date.now()+60*60*1000)});
  const base=process.env.APP_URL||new URL(req.url).origin;await sendPasswordResetEmail(user.email,user.name,`${base}/reset-password?token=${token}`);
 }catch(error){console.error("Forgot password error:",error)}
 return NextResponse.json(generic);
}
