'use client';
import {Dialog} from 'radix-ui';
import {cva,type VariantProps} from 'class-variance-authority';
import {clsx,type ClassValue} from 'clsx';
import {twMerge} from 'tailwind-merge';
import {X,LoaderCircle,ArrowUpRight,ShieldCheck} from 'lucide-react';
import type {ButtonHTMLAttributes,ReactNode} from 'react';
export const cn=(...inputs:ClassValue[])=>twMerge(clsx(inputs));
const buttonVariants=cva('button',{variants:{variant:{default:'button-primary',secondary:'button-secondary',ghost:'button-ghost',danger:'button-danger'},size:{default:'',small:'button-small',icon:'button-icon'}},defaultVariants:{variant:'default',size:'default'}});
export function Button({className,variant,size,busy,children,...props}:ButtonHTMLAttributes<HTMLButtonElement>&VariantProps<typeof buttonVariants>&{busy?:boolean}){return <button className={cn(buttonVariants({variant,size}),className)} {...props} disabled={props.disabled||busy}>{busy&&<LoaderCircle size={16} className="spin"/>}{children}</button>;}
export function Brand(){return <span className="brand"><span className="brand-mark"><i/><i/><i/></span>Bylaw<span className="brand-iq">IQ</span></span>;}
export function Modal({open,onOpenChange,title,description,children,wide=false}:{open:boolean;onOpenChange:(open:boolean)=>void;title:string;description?:string;children:ReactNode;wide?:boolean}){return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className={cn('dialog-content',wide&&'dialog-wide')}><div className="dialog-heading"><div><Dialog.Title>{title}</Dialog.Title><Dialog.Description>{description||'Changes apply to the active building.'}</Dialog.Description></div><Dialog.Close className="icon-button" aria-label="Close dialog"><X size={20}/></Dialog.Close></div>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;}
export function Badge({children,tone='neutral'}:{children:ReactNode;tone?:string}){return <span className={'badge badge-'+tone}>{children}</span>;}
export function Empty({icon,title,description,action}:{icon:ReactNode;title:string;description:string;action?:ReactNode}){return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{description}</p>{action}</div>;}
export function PageHeading({eyebrow,title,description,action}:{eyebrow?:string;title:string;description:string;action?:ReactNode}){return <header className="page-heading"><div>{eyebrow&&<span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{description}</p></div>{action}</header>;}
export function TrustNote(){return <div className="trust-note"><ShieldCheck size={16}/><span>Grounded in your sources. Reviewed by your people.</span><ArrowUpRight size={14}/></div>;}
