import {describe,expect,it} from 'vitest';
import {normalizedDuplicateKey,importedSchemeSchema} from '../src/ingestion.js';
describe('ingestion validation and duplicates',()=>{
 it('normalizes scheme-name duplicates by level and region',()=>{
  expect(normalizedDuplicateKey({name:'  Merit  Award ',government_level:'state',state_name:'Kerala'})).toBe(normalizedDuplicateKey({name:'merit award',government_level:'state',state_name:'kerala'}));
 });
 it('prefers official URL as a duplicate key and strips a trailing slash',()=>{
  expect(normalizedDuplicateKey({name:'A',government_level:'central',official_url:'https://example.gov/app/'})).toBe(normalizedDuplicateKey({name:'B',government_level:'state',official_url:'https://example.gov/app'}));
 });
 it('rejects insecure or malformed official links and impossible age ranges',()=>{
  const base={name:'Scheme',government_level:'central',official_url:'http://example.gov/app',min_age:25,max_age:18};
  expect(importedSchemeSchema.safeParse(base).success).toBe(false);
 });
 it('leaves absent eligibility facts explicitly absent',()=>{
  const parsed=importedSchemeSchema.parse({name:'Unknown conditions scheme',government_level:'state',state_name:'Goa'});
  expect(parsed.annual_income_limit).toBeUndefined();expect(parsed.application_end).toBeUndefined();
 });
});
