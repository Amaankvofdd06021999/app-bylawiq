import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:{default:'BylawIQ · Your building. A clearer answer.',template:'%s · BylawIQ'},description:'Building-specific bylaw intelligence for BC strata. Ask, verify, draft, and manage your sources.',robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en-CA"><body>{children}</body></html>;}
