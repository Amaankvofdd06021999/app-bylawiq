'use client';
import {Button} from '@/components/ui';
export default function ErrorPage({reset}:{reset:()=>void}){return <div className="onboarding"><h1>We couldn’t open this view.</h1><p>Your saved work is still in your workspace. Please retry.</p><Button onClick={reset}>Try again</Button></div>;}
