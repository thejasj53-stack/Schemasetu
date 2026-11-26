import {describe,expect,it} from 'vitest';
import {robotsPermits,sourceIsDue,isPublicHttpsUrl,readBounded} from '../src/sourceChecker.js';
describe('official-source checker safeguards',()=>{
 it('observes robots.txt rules for the SchemeSetu user agent',()=>{
  const text='User-agent: SchemeSetuSourceBot\nDisallow: /private\nAllow: /private/public';
  expect(robotsPermits('https://portal.gov.in/robots.txt',text,'https://portal.gov.in/private/a')).toBe(false);
  expect(robotsPermits('https://portal.gov.in/robots.txt',text,'https://portal.gov.in/private/public')).toBe(true);
 });
 it('checks due intervals without crawling early',()=>{
  const now=new Date('2026-02-01T00:00:00Z');expect(sourceIsDue(null,30,now)).toBe(true);expect(sourceIsDue('2026-01-20T00:00:00Z',30,now)).toBe(false);expect(sourceIsDue('2025-12-01T00:00:00Z',30,now)).toBe(true);
 });
 it('rejects local and non-HTTPS source URLs',async()=>{
  expect(await isPublicHttpsUrl('http://example.gov')).toBe(false);expect(await isPublicHttpsUrl('https://localhost/path')).toBe(false);expect(await isPublicHttpsUrl('https://127.0.0.1/path')).toBe(false);
 });
 it('enforces response byte limits',async()=>{
  const response=new Response(new Uint8Array([1,2,3,4]));await expect(readBounded(response,3)).rejects.toThrow('source_too_large');
 });
});
