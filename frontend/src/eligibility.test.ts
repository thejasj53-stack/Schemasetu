import { describe, expect, it } from 'vitest';
import { evaluateEligibility, evaluateEligibilityDetailed } from './eligibility';

describe('eligibility evaluation',()=>{
 it('marks a profile eligible when every known required rule matches',()=>{
  expect(evaluateEligibility({age:19,region:'Kerala'},[
   {field_name:'age',operator:'gte',expected_value:18,is_required:true},
   {field_name:'region',operator:'eq',expected_value:'Kerala',is_required:true}
  ])).toEqual({status:'eligible',matched:2,failed:[],unknown:[]});
 });
 it('keeps missing information unknown rather than guessing',()=>{
  expect(evaluateEligibility({},[{field_name:'family_income',operator:'lte',expected_value:250000,is_required:true}])).toEqual({status:'needs_information',matched:0,failed:[],unknown:['family_income']});
 });
 it('marks a failed required rule ineligible and ignores optional rules',()=>{
  expect(evaluateEligibility({age:25},[
   {field_name:'age',operator:'lte',expected_value:21,is_required:true},
   {field_name:'gender',operator:'eq',expected_value:'Female',is_required:false}
  ])).toEqual({status:'not_eligible',matched:0,failed:['age'],unknown:[]});
 });
 it('supports allow list and array membership comparisons',()=>{
  expect(evaluateEligibility({region:'Delhi',categories:['SC']},[
   {field_name:'region',operator:'in',expected_value:['Delhi','Punjab'],is_required:true},
   {field_name:'categories',operator:'contains',expected_value:'SC',is_required:true}
  ]).status).toBe('eligible');
 });
});

describe('eligibility guardrails',()=>{
 it('does not label a scholarship eligible when no required rules are published',()=>{
  expect(evaluateEligibility({},[])).toEqual({status:'needs_information',matched:0,failed:[],unknown:['eligibility rules']});
 });
});


describe('detailed rule evaluation',()=>{
 it('supports an OR group without rejecting a matching alternative',()=>{
  const result=evaluateEligibilityDetailed({social_category:'SC'},[
   {criterion_type:'social_category',operator:'eq',criterion_value:'SC',is_mandatory:true,condition_group:'category',condition_operator:'OR'},
   {criterion_type:'social_category',operator:'eq',criterion_value:'ST',is_mandatory:true,condition_group:'category',condition_operator:'OR'}
  ],'2026-27');
  expect(result.status).toBe('eligible');
  expect(result.failed).toEqual([]);
 });
 it('keeps criteria from a different academic year as unknown',()=>{
  const result=evaluateEligibilityDetailed({family_income:100000},[
   {criterion_type:'family_income',operator:'lte',criterion_value:450000,is_mandatory:true,academic_year:'2025-26',verification_status:'verified'}
  ],'2026-27');
  expect(result.status).toBe('needs_information');
  expect(result.criteria[0].status).toBe('unknown');
 });
 it('does not apply a year-specific condition when the student skips academic year',()=>{
  const result=evaluateEligibilityDetailed({family_income:100000},[
   {criterion_type:'family_income',operator:'lte',criterion_value:450000,is_mandatory:true,academic_year:'2025-26',verification_status:'verified',source_url:'https://scholarships.gov.in/scheme'}
  ]);
  expect(result.status).toBe('needs_information');
  expect(result.criteria[0].status).toBe('unknown');
 });
 it('does not make an unverified rule a confirmed pass or failure',()=>{
  const result=evaluateEligibilityDetailed({family_income:900000},[
   {criterion_type:'family_income',operator:'lte',criterion_value:450000,is_mandatory:true,academic_year:'2026-27',verification_status:'needs_verification'}
  ],'2026-27');
  expect(result.status).toBe('needs_information');
  expect(result.failed).toEqual([]);
 });
 it('marks a confirmed failed mandatory rule as not eligible and explains it',()=>{
  const result=evaluateEligibilityDetailed({family_income:900000},[
   {criterion_type:'family_income',operator:'lte',criterion_value:450000,is_mandatory:true,academic_year:'2026-27',verification_status:'verified',source_url:'https://scholarships.gov.in/scheme'}
  ],'2026-27');
  expect(result.status).toBe('not_eligible');
  expect(result.failed).toEqual(['family_income']);
 });
});
