import {test,expect,type Browser,type Page} from '@playwright/test';
// Layout checks run once, from the desktop project, with their own device contexts per width.
const sections=['ask','conversation','portfolio','documents','agents','knowledge','bylaws','notices','disputes','updates','members','settings','audit'];
const routes=[...sections.map(s=>'/preview/'+s),'/login','/signup'];
const tableSections=['documents','bylaws','notices','disputes','members','audit'];
async function device(browser:Browser,width:number,touch:boolean,baseURL:string){const context=await browser.newContext({baseURL,viewport:{width,height:width<900?800:900},isMobile:touch&&width<900,hasTouch:touch});return {context,page:await context.newPage()};}
// Measure only the real page. The app streams it behind loading.tsx: the content arrives inside a hidden
// <div hidden id="S:n"> segment and is swapped in later, so measuring at the load event saw 0x0 elements.
async function open(page:Page,route:string){await page.goto(route);await page.waitForFunction(()=>!document.querySelector('div[hidden][id^="S:"]')&&!document.querySelector('[aria-label="Loading workspace"]'));}
const desktopOnly=(name:string)=>{test.skip(name!=='desktop','Runs once with its own device contexts');test.setTimeout(180_000);};

test('no page scrolls sideways and the top bar stays on one line at any width',async({browser,baseURL},info)=>{desktopOnly(info.project.name);
 for(const width of [360,390,768,1024,1440]){const {context,page}=await device(browser,width,width<1440,baseURL!);
  for(const route of routes){await open(page,route);
   const r=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,crumb:document.querySelector('.breadcrumb')?.getBoundingClientRect().height??0}));
   expect.soft(r.overflow,`${route} at ${width}px scrolls sideways`).toBeLessThanOrEqual(0);
   expect.soft(r.crumb,`${route} at ${width}px wraps the top bar`).toBeLessThanOrEqual(24);}
  await context.close();}});

async function smallTargets(page:Page){return page.evaluate(()=>{const hiddenSidebar=(e:Element)=>{const s=e.closest('.sidebar');return !!s&&!s.classList.contains('sidebar-open');};
 return [...document.querySelectorAll('a,button,select,input,textarea,[role=button]')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&!hiddenSidebar(e)&&!e.closest('p')&&!e.matches('.citation-link,.skip-link,textarea');})
  .map(e=>{const target=e.closest('label')||e;const r=target.getBoundingClientRect();return {name:(e.getAttribute('aria-label')||target.textContent||e.tagName).trim().slice(0,30),w:Math.round(r.width),h:Math.round(r.height)};})
  .filter(t=>t.w<44||t.h<44);});}
test('controls are at least 44px on touch screens',async({browser,baseURL},info)=>{desktopOnly(info.project.name);
 for(const width of [390,768]){const {context,page}=await device(browser,width,true,baseURL!);
  for(const route of routes){await open(page,route);expect.soft(await smallTargets(page),`${route} at ${width}px`).toEqual([]);}
  await open(page,'/preview/conversation');const hit=await page.evaluate(()=>{const c=document.querySelector('.citation-link')!;c.scrollIntoView({block:'center'});const r=c.getBoundingClientRect();const e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2-12);return e?.closest('.citation-link')===c?'citation':`${e?.tagName.toLowerCase()}.${String(e?.className).split(' ')[0]} (citation ${Math.round(r.width)}x${Math.round(r.height)}, before ${getComputedStyle(c,'::before').height})`;});
  expect.soft(hit,`citation tap area at ${width}px`).toBe('citation');
  await context.close();}});

test('tables fit phones without sideways scrolling',async({browser,baseURL},info)=>{desktopOnly(info.project.name);const {context,page}=await device(browser,360,true,baseURL!);
 for(const section of tableSections){await open(page,'/preview/'+section);
  const r=await page.evaluate(()=>{const t=document.querySelector('.resource-table')!;const offscreen=[...t.querySelectorAll('.row-actions a,.row-actions button')].filter(b=>b.getBoundingClientRect().right>innerWidth).length;return {scroll:t.scrollWidth-t.clientWidth,offscreen};});
  expect.soft(r.scroll,`${section} table scrolls sideways`).toBeLessThanOrEqual(0);expect.soft(r.offscreen,`${section} row actions off screen`).toBe(0);}
 await context.close();});

test('the phone menu does not repeat the bottom bar',async({browser,baseURL},info)=>{desktopOnly(info.project.name);
 const {context,page}=await device(browser,390,true,baseURL!);await open(page,'/preview/documents');
 await page.getByRole('navigation',{name:'Sections'}).getByRole('button',{name:'More'}).click();const drawer=page.getByRole('navigation',{name:'Main navigation'});
 for(const repeated of ['Ask BylawIQ','Bylaws','Documents','Updates'])await expect.soft(drawer.getByRole('link',{name:new RegExp('^'+repeated)})).toBeHidden();
 await expect.soft(page.getByRole('link',{name:/New conversation/})).toBeHidden();
 for(const kept of ['Notices','Disputes','Team members','Settings'])await expect.soft(drawer.getByRole('link',{name:kept})).toBeAttached();
 await expect.soft(page.locator('.topbar').getByRole('link',{name:'Updates'})).toBeHidden();await expect.soft(page.locator('.topbar .avatar')).toBeHidden();
 await context.close();
 const desk=await device(browser,1440,false,baseURL!);await open(desk.page,'/preview/documents');const sidebar=desk.page.getByRole('navigation',{name:'Main navigation'});
 for(const item of ['Ask BylawIQ','Bylaws','Documents','Updates','Notices'])await expect.soft(sidebar.getByRole('link',{name:new RegExp(item)})).toBeVisible();
 await expect.soft(desk.page.getByRole('link',{name:/New conversation/})).toBeVisible();await desk.context.close();});

test('the ask box and filter tabs stay on one row on phones',async({browser,baseURL},info)=>{desktopOnly(info.project.name);const {context,page}=await device(browser,360,true,baseURL!);
 await open(page,'/preview/ask');const composer=await page.evaluate(()=>{const row=document.querySelector('.hero-ask .composer-bottom')!;const tops=[...row.children].map(c=>Math.round(c.getBoundingClientRect().top));return {rows:new Set(tops).size,overflow:document.documentElement.scrollWidth-innerWidth};});
 expect.soft(composer.rows,'ask box controls wrap onto more than one row').toBe(1);expect.soft(composer.overflow).toBeLessThanOrEqual(0);
 await open(page,'/preview/documents');const tabs=await page.evaluate(()=>{const f=document.querySelector('.tab-filter')!;return new Set([...f.children].map(c=>Math.round(c.getBoundingClientRect().top))).size;});
 expect.soft(tabs,'filter tabs wrap onto more than one row').toBe(1);
 await context.close();});
