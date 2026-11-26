import {describe,expect,it} from 'vitest';
import {planReminders} from '../src/notifications.js';
describe('deadline reminder planning',()=>{
 const now=new Date('2026-01-01T00:00:00.000Z');
 it('schedules configured reminder offsets and a stable dedupe key',()=>{
  const rows=planReminders({userId:'u1',scholarshipId:'s1',name:'Merit',deadline:'2026-03-01',days:[30,7,2,1],now,verified:true});
  expect(rows.map(x=>x.payload.days)).toEqual([30,7,1]);expect(new Set(rows.map(x=>x.dedupe_key)).size).toBe(3);
 });
 it('never schedules reminders from unverified or expired deadlines',()=>{
  expect(planReminders({userId:'u',scholarshipId:'s',name:'X',deadline:'2026-03-01',days:[7],now,verified:false})).toEqual([]);
  expect(planReminders({userId:'u',scholarshipId:'s',name:'X',deadline:'2025-12-01',days:[7],now,verified:true})).toEqual([]);
 });
 it('pulls a near deadline reminder forward instead of silently missing it',()=>{
  const rows=planReminders({userId:'u',scholarshipId:'s',name:'X',deadline:'2026-01-03',days:[7],now,verified:true});
  expect(rows).toHaveLength(1);expect(rows[0].scheduled_for).toBe(now.toISOString());
 });
});
