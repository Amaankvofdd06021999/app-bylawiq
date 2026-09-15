import type {Metadata,Viewport} from 'next';
import './globals.css';
// viewport-fit=cover lets the mobile bottom bar extend under the iPhone home indicator; it pads itself with safe-area insets.
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover'};
export const metadata:Metadata={title:{default:'BylawIQ · Your building. A clearer answer.',template:'%s · BylawIQ'},description:'Building-specific bylaw intelligence for BC strata. Ask, verify, draft, and manage your sources.',robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en-CA"><body>{children}</body></html>;}
