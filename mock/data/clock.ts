// Seeded dates are relative to when a demo session is seeded (`mock/store.ts#seed`), so "waiting 7 days", "due in
// 9 days" and "this month" stay true as the real date moves. Times of day stay fixed (UTC) so the seed still
// reads naturally. Historical facts (filing dates, "Consolidated 2025") stay absolute in their own modules.
const DAY=86400000;
export type Clock={
 /** `days` before seed day at `time` (UTC, "HH:MM"), as "YYYY-MM-DDTHH:MM:00Z". */
 ago:(days:number,time?:string)=>string;
 /** `days` after seed day at `time` (UTC). */
 ahead:(days:number,time?:string)=>string;
 /** A date only ("YYYY-MM-DD"), `days` after seed day (negative for before). */
 date:(days:number)=>string;
 /** Seed month, "YYYY-MM". */
 month:string;
};
export function clock(now:Date):Clock{
 const day=(days:number)=>new Date(now.getTime()+days*DAY).toISOString().slice(0,10);
 const at=(days:number,time='09:00')=>`${day(days)}T${time}:00Z`;
 return {ago:(days,time)=>at(-days,time),ahead:(days,time)=>at(days,time),date:day,month:now.toISOString().slice(0,7)};
}
