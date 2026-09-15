'use server';
import {z} from 'zod';
import {headers} from 'next/headers';
import {createHash} from 'node:crypto';
import {db} from '@/lib/supabase/server';
import {requireUser} from '@/lib/auth/guards';
import {rateLimit} from '@/lib/security/rate-limit';
import {checkDb,errorMessage,AppError} from '@/lib/errors';
import {appUrl} from '@/lib/env';
export async function authAction(raw:unknown){try{
 const v=z.object({mode:z.enum(['login','signup','forgot','reset']),email:z.email().toLowerCase().trim(),password:z.string().min(12).max(128).optional(),consent:z.boolean().optional()}).parse(raw);
 const h=await headers();const ip=h.get('x-real-ip')||h.get('x-forwarded-for')?.split(',')[0]||'unknown';await rateLimit(createHash('sha256').update(ip).digest('hex'),'auth');
 const client=await db();const appUrlValue=appUrl();
 if(v.mode==='forgot'){const {error}=await client.auth.resetPasswordForEmail(v.email,{redirectTo:appUrlValue+'/auth/callback?next=/reset'});if(error)throw new AppError('auth_error','Unable to request a reset. Try again shortly.');return {ok:true,message:'If an account exists, a password reset link is on its way.'};}
 if(!v.password)throw new AppError('password_required','Enter a password with at least 12 characters.');
 if(v.mode==='reset'){await requireUser();const {error}=await client.auth.updateUser({password:v.password});if(error)throw new AppError('auth_error','The password could not be updated. Request a new reset link.');return {ok:true,redirect:'/workspace'};}
 if(v.mode==='signup'){if(!v.consent)throw new AppError('consent_required','Accept the legal information and privacy acknowledgement to continue.');const {error}=await client.auth.signUp({email:v.email,password:v.password,options:{emailRedirectTo:appUrlValue+'/auth/callback'}});if(error)throw new AppError('auth_error','Unable to create the account. Check your details or sign in.');return {ok:true,message:'Check your email to verify your account, then sign in.'};}
 const {error}=await client.auth.signInWithPassword({email:v.email,password:v.password});if(error)throw new AppError('auth_error','Email or password is incorrect, or email verification is pending.',401);return {ok:true,redirect:'/workspace'};
 }catch(e){return {ok:false,error:errorMessage(e)};}}
export async function signOutAction(){const user=await requireUser();await user.client.auth.signOut();return {ok:true};}
export async function onboardAction(raw:unknown){try{const user=await requireUser();const v=z.object({name:z.string().min(2).max(100),organization:z.string().min(2).max(120),building:z.string().min(2).max(120),accountType:z.enum(['admin','multi_building','single_building']),consent:z.literal(true)}).parse(raw);const {data,error}=await user.client.rpc('bootstrap_workspace',{p_name:v.organization,p_building_name:v.building,p_account_type:v.accountType,p_display_name:v.name});checkDb(error);await user.client.auth.refreshSession();return {ok:true,buildingId:String(data)};}catch(e){return {ok:false,error:errorMessage(e)};}}
export async function acceptInviteAction(token:string){try{const user=await requireUser();z.string().regex(/^[a-f0-9]{64}$/).parse(token);const {data,error}=await user.client.rpc('accept_invitation',{p_hash:createHash('sha256').update(token).digest('hex')});checkDb(error);await user.client.auth.refreshSession();return {ok:true,buildingId:String(data)};}catch(e){return {ok:false,error:errorMessage(e)};}}
